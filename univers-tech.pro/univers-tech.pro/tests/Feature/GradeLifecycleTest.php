<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Course;
use App\Models\Department;
use App\Models\Grade;
use App\Models\GradeAppeal;
use App\Models\Level;
use App\Models\Semester;
use App\Models\StudentCourse;
use App\Models\User;
use App\Support\Settings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GradeLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private Admin $superAdmin;

    private Department $department;

    private Semester $semester;

    private User $student;

    private User $otherStudent;

    private User $professor;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = Admin::factory()->create(['id' => 1, 'is_super_admin' => true]);
        $this->department = Department::factory()->create(['admin_id' => $this->superAdmin->id]);
        $level = Level::factory()->create();

        $this->semester = Semester::create([
            'name' => 'Fall',
            'academic_year' => '2026',
            'is_active' => true,
        ]);

        $this->professor = $this->makeProfessor();
        $this->student = $this->makeStudent();
        $this->otherStudent = $this->makeStudent();
    }

    private function makeProfessor(): User
    {
        return User::factory()->create([
            'type' => User::TYPE_PROFESSOR,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ]);
    }

    private function makeStudent(): User
    {
        $user = User::factory()->create([
            'type' => User::TYPE_STUDENT,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ]);

        $user->student()->create([
            'department_id' => $this->department->id,
            'level_id' => Level::query()->value('id'),
            'semester' => 'first',
            'credit_points' => 0,
        ]);

        return $user;
    }

    private function makeCourse(?User $professor = null): Course
    {
        static $n = 0;
        $n++;

        $course = Course::create([
            'course_name' => 'Course ' . $n,
            'course_code' => 'C' . $n . '-' . uniqid(),
            'no_of_hours' => 3,
            'cover_image' => 'default.jpg',
            'department_id' => $this->department->id,
            'professor_id' => ($professor ?? $this->professor)->id,
            'admin_id' => $this->superAdmin->id,
            'semester_id' => $this->semester->id,
        ]);

        StudentCourse::create([
            'student_id' => $this->student->id,
            'course_id' => $course->id,
            'status' => StudentCourse::STATUS_REGISTERED,
            'semester_id' => $this->semester->id,
        ]);

        return $course;
    }

    private function storeGrade(User $professor, Course $course, array $overrides = [])
    {
        Sanctum::actingAs($professor);

        return $this->postJson('/api/professor/grade/store', array_merge([
            'student_id' => $this->student->id,
            'course_id' => $course->id,
            'marks' => 80,
            'max_marks' => 100,
        ], $overrides));
    }

    public function test_professor_grades_are_created_as_draft_and_invisible_to_students(): void
    {
        $course = $this->makeCourse();

        $this->storeGrade($this->professor, $course)
            ->assertOk()
            ->assertJsonPath('data.status', Grade::STATUS_DRAFT);

        $this->assertDatabaseHas('grades', [
            'student_id' => $this->student->id,
            'course_id' => $course->id,
            'status' => Grade::STATUS_DRAFT,
        ]);

        Sanctum::actingAs($this->student);
        $reports = $this->getJson('/api/user/reports')->assertOk();
        $this->assertSame(0, $reports->json('data.overall.total_graded_courses'));
        $this->assertCount(0, $reports->json('data.semester_cards'));
    }

    public function test_publishing_a_grade_makes_it_visible_and_notifies_the_student(): void
    {
        $course = $this->makeCourse();
        $gradeId = $this->storeGrade($this->professor, $course)->json('data.id');

        Sanctum::actingAs($this->professor);
        $this->postJson('/api/professor/grade/publish', ['grade_id' => $gradeId])
            ->assertOk()
            ->assertJsonPath('data.status', Grade::STATUS_PUBLISHED);

        $this->assertDatabaseHas('grades', ['id' => $gradeId, 'status' => Grade::STATUS_PUBLISHED]);
        $this->assertDatabaseHas('notifications', ['student_id' => $this->student->id]);
        $this->assertDatabaseHas('activity_logs', ['action' => 'grade_published']);

        Sanctum::actingAs($this->student);
        $this->getJson('/api/user/reports')->assertOk()->assertJsonPath('data.overall.total_graded_courses', 1);
    }

    public function test_professor_can_bulk_publish_a_course(): void
    {
        $course = $this->makeCourse();
        $this->storeGrade($this->professor, $course);
        $this->storeGrade($this->professor, $course, ['marks' => 70]);

        Sanctum::actingAs($this->professor);
        $this->postJson('/api/professor/grade/publish', ['course_id' => $course->id])
            ->assertOk()
            ->assertJsonPath('data.published', 1);

        $this->assertSame(0, Grade::where('course_id', $course->id)->where('status', Grade::STATUS_DRAFT)->count());
    }

    public function test_professor_editing_a_published_grade_requires_a_reason(): void
    {
        $course = $this->makeCourse();
        $gradeId = $this->storeGrade($this->professor, $course)->json('data.id');

        Sanctum::actingAs($this->professor);
        $this->postJson('/api/professor/grade/publish', ['grade_id' => $gradeId])->assertOk();

        // Published grade inside the edit window: marks change without a reason is rejected.
        $this->storeGrade($this->professor, $course, ['marks' => 55])->assertStatus(422);

        // With a reason it succeeds.
        $this->storeGrade($this->professor, $course, ['marks' => 55, 'reason' => 'Re-mark'])
            ->assertOk()
            ->assertJsonPath('data.marks', '55.00');
    }

    public function test_professor_is_blocked_after_the_edit_window_closes(): void
    {
        $course = $this->makeCourse();

        $grade = Grade::create([
            'student_id' => $this->student->id,
            'course_id' => $course->id,
            'semester_id' => $this->semester->id,
            'marks' => 80,
            'max_marks' => 100,
            'status' => Grade::STATUS_PUBLISHED,
            'published_at' => now()->subHours(100),
        ]);

        $this->storeGrade($this->professor, $course, ['marks' => 55, 'reason' => 'Late edit'])
            ->assertStatus(403);

        $this->assertSame('80.00', (string) $grade->fresh()->marks);
    }

    public function test_professor_is_blocked_when_the_grade_is_locked(): void
    {
        $course = $this->makeCourse();

        $grade = Grade::create([
            'student_id' => $this->student->id,
            'course_id' => $course->id,
            'semester_id' => $this->semester->id,
            'marks' => 80,
            'max_marks' => 100,
            'status' => Grade::STATUS_PUBLISHED,
            'published_at' => now(),
        ]);

        Sanctum::actingAs($this->superAdmin);
        $this->postJson('/api/grade/lock/' . $grade->id)->assertOk();

        $this->storeGrade($this->professor, $course, ['marks' => 55, 'reason' => 'Try'])
            ->assertStatus(403);
    }

    public function test_admin_override_requires_a_reason_and_is_audited(): void
    {
        $course = $this->makeCourse();
        $grade = Grade::create([
            'student_id' => $this->student->id,
            'course_id' => $course->id,
            'semester_id' => $this->semester->id,
            'marks' => 80,
            'max_marks' => 100,
            'status' => Grade::STATUS_LOCKED,
            'published_at' => now(),
            'locked_at' => now(),
        ]);

        Sanctum::actingAs($this->superAdmin);
        $this->postJson('/api/grade/override', [
            'grade_id' => $grade->id,
            'marks' => 65,
            'max_marks' => 100,
        ])->assertStatus(422)->assertJsonValidationErrors('reason');

        $this->postJson('/api/grade/override', [
            'grade_id' => $grade->id,
            'marks' => 65,
            'max_marks' => 100,
            'reason' => 'Recount of the final exam.',
        ])->assertOk()->assertJsonPath('data.marks', '65.00');

        $this->assertDatabaseHas('activity_logs', ['action' => 'grade_overridden']);
    }

    public function test_gpa_ignores_draft_grades(): void
    {
        $publishedCourse = $this->makeCourse();
        $draftCourse = $this->makeCourse();

        Grade::create([
            'student_id' => $this->student->id,
            'course_id' => $publishedCourse->id,
            'semester_id' => $this->semester->id,
            'marks' => 50,
            'max_marks' => 100,
            'status' => Grade::STATUS_PUBLISHED,
            'published_at' => now(),
        ]);

        Grade::create([
            'student_id' => $this->student->id,
            'course_id' => $draftCourse->id,
            'semester_id' => $this->semester->id,
            'marks' => 100,
            'max_marks' => 100,
            'status' => Grade::STATUS_DRAFT,
        ]);

        Sanctum::actingAs($this->student);
        $reports = $this->getJson('/api/user/reports')->assertOk();

        $this->assertSame(1, $reports->json('data.overall.total_graded_courses'));
        $this->assertSame(1.0, (float) $reports->json('data.overall.cumulative_gpa'));
    }

    public function test_ownership_is_still_enforced_for_grades(): void
    {
        $course = $this->makeCourse();
        $intruder = $this->makeProfessor();

        $this->storeGrade($intruder, $course)->assertStatus(403);
    }

    public function test_component_weights_must_total_one_hundred(): void
    {
        $course = $this->makeCourse();

        Sanctum::actingAs($this->professor);
        $this->postJson('/api/professor/grade/component/sync', [
            'course_id' => $course->id,
            'components' => [
                ['name' => 'Coursework', 'weight' => 40],
                ['name' => 'Final', 'weight' => 50],
            ],
        ])->assertStatus(422);
    }

    public function test_final_score_is_computed_from_components(): void
    {
        $course = $this->makeCourse();

        Sanctum::actingAs($this->professor);
        $this->postJson('/api/professor/grade/component/sync', [
            'course_id' => $course->id,
            'components' => [
                ['name' => 'Coursework', 'weight' => 40],
                ['name' => 'Final', 'weight' => 60],
            ],
        ])->assertOk();

        $components = $course->gradeComponents()->get();
        $coursework = $components->firstWhere('name', 'Coursework');
        $final = $components->firstWhere('name', 'Final');

        $response = $this->storeGrade($this->professor, $course, [
            'component_scores' => [
                ['grade_component_id' => $coursework->id, 'marks' => 80, 'max_marks' => 100],
                ['grade_component_id' => $final->id, 'marks' => 90, 'max_marks' => 100],
            ],
        ])->assertOk();

        // 80% * 40 + 90% * 60 = 86%
        $this->assertSame('86.00', $response->json('data.marks'));

        // Publish, then the student sees the component breakdown.
        $gradeId = $response->json('data.id');
        Sanctum::actingAs($this->professor);
        $this->postJson('/api/professor/grade/publish', ['grade_id' => $gradeId])->assertOk();

        Sanctum::actingAs($this->student);
        $rows = $this->getJson('/api/user/reports')->assertOk()->json('data.semester_cards.0.courses');
        $this->assertCount(2, $rows[0]['components']);
    }

    public function test_appeal_window_is_enforced(): void
    {
        $course = $this->makeCourse();
        $grade = Grade::create([
            'student_id' => $this->student->id,
            'course_id' => $course->id,
            'semester_id' => $this->semester->id,
            'marks' => 55,
            'max_marks' => 100,
            'status' => Grade::STATUS_PUBLISHED,
            'published_at' => now()->subDays(Settings::appealWindowDays() + 1),
        ]);

        Sanctum::actingAs($this->student);
        $this->postJson('/api/user/grade/appeal', [
            'grade_id' => $grade->id,
            'reason' => 'Please recheck.',
        ])->assertStatus(422);

        $grade->update(['published_at' => now()]);

        $this->postJson('/api/user/grade/appeal', [
            'grade_id' => $grade->id,
            'reason' => 'Please recheck.',
        ])->assertOk();

        $this->assertDatabaseHas('grade_appeals', [
            'grade_id' => $grade->id,
            'student_id' => $this->student->id,
            'status' => GradeAppeal::STATUS_PENDING,
        ]);
    }

    public function test_only_the_grades_owner_student_can_appeal(): void
    {
        $course = $this->makeCourse();
        $grade = Grade::create([
            'student_id' => $this->student->id,
            'course_id' => $course->id,
            'semester_id' => $this->semester->id,
            'marks' => 55,
            'max_marks' => 100,
            'status' => Grade::STATUS_PUBLISHED,
            'published_at' => now(),
        ]);

        Sanctum::actingAs($this->otherStudent);
        $this->postJson('/api/user/grade/appeal', [
            'grade_id' => $grade->id,
            'reason' => 'Not mine.',
        ])->assertStatus(404);
    }

    public function test_only_the_owning_professor_or_an_admin_can_respond_to_an_appeal(): void
    {
        $course = $this->makeCourse();
        $grade = Grade::create([
            'student_id' => $this->student->id,
            'course_id' => $course->id,
            'semester_id' => $this->semester->id,
            'marks' => 55,
            'max_marks' => 100,
            'status' => Grade::STATUS_PUBLISHED,
            'published_at' => now(),
        ]);

        Sanctum::actingAs($this->student);
        $appealId = $this->postJson('/api/user/grade/appeal', [
            'grade_id' => $grade->id,
            'reason' => 'Please recheck.',
        ])->json('data.id');

        $intruder = $this->makeProfessor();
        Sanctum::actingAs($intruder);
        $this->postJson('/api/professor/appeal/respond', [
            'appeal_id' => $appealId,
            'action' => 'accept',
            'note' => 'Nope',
        ])->assertStatus(403);

        Sanctum::actingAs($this->professor);
        $this->postJson('/api/professor/appeal/respond', [
            'appeal_id' => $appealId,
            'action' => 'accept',
            'note' => 'Marks corrected.',
        ])->assertOk()->assertJsonPath('data.status', GradeAppeal::STATUS_ACCEPTED);

        $this->assertDatabaseHas('grade_appeals', [
            'id' => $appealId,
            'status' => GradeAppeal::STATUS_ACCEPTED,
        ]);
        $this->assertDatabaseHas('notifications', ['student_id' => $this->student->id]);
    }
}
