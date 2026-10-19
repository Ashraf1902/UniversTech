<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Course;
use App\Models\Department;
use App\Models\Grade;
use App\Models\Level;
use App\Models\Payment;
use App\Models\Schedule;
use App\Models\Semester;
use App\Models\StudentCourse;
use App\Models\User;
use App\Support\Settings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EnrollmentRulesTest extends TestCase
{
    use RefreshDatabase;

    private Admin $superAdmin;

    private Department $department;

    private Semester $semester;

    private User $student;

    private User $otherStudent;

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

        $this->student = $this->makeStudent($this->department->id, $level->id);
        $this->otherStudent = $this->makeStudent($this->department->id, $level->id);
    }

    private function makeStudent(?int $departmentId, ?int $levelId): User
    {
        $user = User::factory()->create([
            'type' => User::TYPE_STUDENT,
            'status' => User::STATUS_ACTIVE,
            'password' => bcrypt('password'),
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ]);

        $user->student()->create([
            'department_id' => $departmentId,
            'level_id' => $levelId,
            'semester' => 'first',
            'credit_points' => 0,
        ]);

        return $user;
    }

    private function makeCourse(array $attributes = []): Course
    {
        static $n = 0;
        $n++;

        return Course::create(array_merge([
            'course_name' => 'Course ' . $n,
            'course_code' => 'C' . $n . '-' . uniqid(),
            'no_of_hours' => 3,
            'cover_image' => 'default.jpg',
            'department_id' => $this->department->id,
            'professor_id' => null,
            'admin_id' => $this->superAdmin->id,
            'semester_id' => $this->semester->id,
        ], $attributes));
    }

    private function register(User $student, array $courseIds)
    {
        Sanctum::actingAs($student);

        return $this->postJson('/api/user/register-course', ['course_ids' => $courseIds]);
    }

    public function test_registration_is_closed_when_no_active_semester(): void
    {
        $this->semester->update(['is_active' => false]);
        $course = $this->makeCourse();

        $this->register($this->student, [$course->id])
            ->assertStatus(422)
            ->assertJsonPath('data.errors.0.reason', 'registration_closed');

        $this->assertDatabaseCount('student_courses', 0);
    }

    public function test_registration_is_closed_before_the_window_opens(): void
    {
        $this->semester->update(['registration_opens_at' => now()->addDay()]);
        $course = $this->makeCourse();

        $this->register($this->student, [$course->id])
            ->assertStatus(422)
            ->assertJsonPath('data.errors.0.reason', 'registration_closed');
    }

    public function test_student_can_register_within_an_open_window(): void
    {
        $this->semester->update([
            'registration_opens_at' => now()->subDay(),
            'registration_closes_at' => now()->addDay(),
        ]);
        $course = $this->makeCourse();

        $this->register($this->student, [$course->id])
            ->assertOk()
            ->assertJsonPath('data.registered.0', $course->id);

        $this->assertDatabaseHas('student_courses', [
            'student_id' => $this->student->id,
            'course_id' => $course->id,
            'status' => StudentCourse::STATUS_REGISTERED,
            'semester_id' => $this->semester->id,
        ]);
    }

    public function test_credit_limit_is_enforced_and_the_batch_rolls_back(): void
    {
        Settings::set('credit_limit', 3);

        $courseA = $this->makeCourse(['no_of_hours' => 3]);
        $courseB = $this->makeCourse(['no_of_hours' => 3]);

        $this->register($this->student, [$courseA->id, $courseB->id])
            ->assertStatus(422)
            ->assertJsonPath('data.errors.0.reason', 'credit_limit_exceeded');

        $this->assertDatabaseCount('student_courses', 0);

        $this->register($this->student, [$courseA->id])->assertOk();
        $this->assertDatabaseCount('student_courses', 1);
    }

    public function test_capacity_is_enforced(): void
    {
        $course = $this->makeCourse(['capacity' => 1]);

        $this->register($this->student, [$course->id])->assertOk();

        $this->register($this->otherStudent, [$course->id])
            ->assertStatus(422)
            ->assertJsonPath('data.errors.0.reason', 'course_full');
    }

    public function test_prerequisites_must_be_passed(): void
    {
        $prerequisite = $this->makeCourse(['course_code' => 'PRE-' . uniqid()]);
        $course = $this->makeCourse();
        $course->prerequisites()->attach($prerequisite->id);

        $this->register($this->student, [$course->id])
            ->assertStatus(422)
            ->assertJsonPath('data.errors.0.reason', 'prerequisites_not_met');

        Grade::create([
            'student_id' => $this->student->id,
            'course_id' => $prerequisite->id,
            'semester_id' => $this->semester->id,
            'marks' => 60,
            'max_marks' => 100,
        ]);

        $this->register($this->student, [$course->id])->assertOk();
    }

    public function test_schedule_conflicts_block_registration(): void
    {
        $courseA = $this->makeCourse();
        $courseB = $this->makeCourse();

        foreach ([$courseA, $courseB] as $course) {
            Schedule::create([
                'course_id' => $course->id,
                'semester_id' => $this->semester->id,
                'department_id' => $this->department->id,
                'day_of_week' => 1,
                'start_time' => '09:00',
                'end_time' => '10:00',
                'section_type' => 'lecture',
                'admin_id' => $this->superAdmin->id,
            ]);
        }

        $this->register($this->student, [$courseA->id])->assertOk();

        $this->register($this->student, [$courseB->id])
            ->assertStatus(422)
            ->assertJsonPath('data.errors.0.reason', 'schedule_conflict');
    }

    public function test_a_batch_with_one_invalid_course_writes_nothing(): void
    {
        $valid = $this->makeCourse();
        $otherDepartment = Department::factory()->create(['admin_id' => $this->superAdmin->id]);
        $invalid = $this->makeCourse(['department_id' => $otherDepartment->id]);

        $this->register($this->student, [$valid->id, $invalid->id])
            ->assertStatus(422)
            ->assertJsonPath('data.errors.0.reason', 'not_in_department');

        $this->assertDatabaseCount('student_courses', 0);
    }

    public function test_dropping_a_course_marks_it_dropped_and_hides_it(): void
    {
        $professor = User::factory()->create([
            'type' => User::TYPE_PROFESSOR,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ]);

        $course = $this->makeCourse(['professor_id' => $professor->id]);
        $this->register($this->student, [$course->id])->assertOk();

        Sanctum::actingAs($this->student);
        $this->postJson('/api/user/drop-course', ['course_id' => $course->id])->assertOk();

        $this->assertDatabaseHas('student_courses', [
            'student_id' => $this->student->id,
            'course_id' => $course->id,
            'status' => StudentCourse::STATUS_DROPPED,
        ]);

        // Catalog now reports the course as not registered.
        Sanctum::actingAs($this->student);
        $catalog = $this->getJson('/api/user/all-courses')->assertOk()->json('data');
        $entry = collect($catalog)->firstWhere('id', $course->id);
        $this->assertNotNull($entry);
        $this->assertFalse($entry['already_registered']);

        // Professor no longer sees the student in the course.
        Sanctum::actingAs($professor);
        $this->getJson('/api/professors/course/student?course_id=' . $course->id)
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_drop_window_can_close(): void
    {
        Settings::set('drop_window_days', 0);
        $this->semester->update(['registration_closes_at' => now()->subDay()]);

        $course = $this->makeCourse();
        StudentCourse::create([
            'student_id' => $this->student->id,
            'course_id' => $course->id,
            'status' => StudentCourse::STATUS_REGISTERED,
            'status_changed_at' => now()->subDays(3),
            'semester_id' => $this->semester->id,
        ]);

        Sanctum::actingAs($this->student);
        $this->postJson('/api/user/drop-course', ['course_id' => $course->id])
            ->assertStatus(422)
            ->assertJsonPath('data.reason', 'drop_window_closed');
    }

    public function test_dropped_course_can_be_re_registered(): void
    {
        $course = $this->makeCourse();
        $this->register($this->student, [$course->id])->assertOk();

        Sanctum::actingAs($this->student);
        $this->postJson('/api/user/drop-course', ['course_id' => $course->id])->assertOk();

        $this->register($this->student, [$course->id])->assertOk();

        $this->assertDatabaseHas('student_courses', [
            'student_id' => $this->student->id,
            'course_id' => $course->id,
            'status' => StudentCourse::STATUS_REGISTERED,
        ]);
    }

    public function test_admin_can_override_enrollment_with_a_note_and_it_is_audited(): void
    {
        // Close registration so a normal enroll would be rejected.
        $this->semester->update(['is_active' => false]);
        $course = $this->makeCourse();

        Sanctum::actingAs($this->superAdmin);
        $this->postJson('/api/course/enrollment/enroll', [
            'course_id' => $course->id,
            'student_id' => $this->student->id,
            'override' => true,
            'note' => 'Transferred student.',
        ])->assertOk();

        $this->assertDatabaseHas('student_courses', [
            'student_id' => $this->student->id,
            'course_id' => $course->id,
            'status' => StudentCourse::STATUS_REGISTERED,
        ]);

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'enrollment_status_changed',
            'subject_type' => StudentCourse::class,
        ]);
    }

    public function test_admin_override_requires_a_note(): void
    {
        $course = $this->makeCourse();

        Sanctum::actingAs($this->superAdmin);
        $this->postJson('/api/course/enrollment/enroll', [
            'course_id' => $course->id,
            'student_id' => $this->student->id,
            'override' => true,
        ])->assertStatus(422)->assertJsonValidationErrors('note', 'data');
    }

    public function test_admin_can_unenroll_a_student(): void
    {
        $course = $this->makeCourse();
        $this->register($this->student, [$course->id])->assertOk();

        Sanctum::actingAs($this->superAdmin);
        $this->postJson('/api/course/enrollment/unenroll', [
            'course_id' => $course->id,
            'student_id' => $this->student->id,
        ])->assertOk();

        $this->assertDatabaseHas('student_courses', [
            'student_id' => $this->student->id,
            'course_id' => $course->id,
            'status' => StudentCourse::STATUS_DROPPED,
        ]);
    }

    public function test_admin_without_the_courses_scope_cannot_manage_enrollment(): void
    {
        $course = $this->makeCourse();

        $admin = Admin::factory()->create(['is_super_admin' => false, 'roles' => ['reports']]);
        Sanctum::actingAs($admin);

        $this->getJson('/api/course/enrollment/get/all?course_id=' . $course->id)->assertStatus(403);
    }

    public function test_dropped_courses_are_hidden_from_my_courses(): void
    {
        Payment::forceCreate([
            'user_id' => $this->student->id,
            'amount' => Payment::PRICE_COURSES,
            'type' => Payment::TYPE_COURSES,
            'status' => Payment::STATUS_PAID,
        ]);

        $course = $this->makeCourse();
        $this->register($this->student, [$course->id])->assertOk();

        Sanctum::actingAs($this->student);
        $this->getJson('/api/user/courses')->assertOk()->assertJsonCount(1, 'data');

        Sanctum::actingAs($this->student);
        $this->postJson('/api/user/drop-course', ['course_id' => $course->id])->assertOk();

        Sanctum::actingAs($this->student);
        $this->getJson('/api/user/courses')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_attendance_cannot_be_recorded_for_a_dropped_student(): void
    {
        $professor = User::factory()->create([
            'type' => User::TYPE_PROFESSOR,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ]);

        $course = $this->makeCourse(['professor_id' => $professor->id]);

        $lecture = \App\Models\Lecture::create([
            'name' => 'Intro',
            'content' => 'lectures/intro.pdf',
            'course_id' => $course->id,
        ]);

        $this->register($this->student, [$course->id])->assertOk();

        Sanctum::actingAs($this->student);
        $this->postJson('/api/user/drop-course', ['course_id' => $course->id])->assertOk();

        Sanctum::actingAs($professor);
        $this->postJson('/api/professors/make/attendance', [
            'date' => now()->toDateString(),
            'status' => true,
            'student_id' => $this->student->id,
            'lecture_id' => $lecture->id,
        ])->assertStatus(404);
    }

    public function test_settings_endpoint_updates_policy_values(): void
    {
        Sanctum::actingAs($this->superAdmin);

        $this->postJson('/api/settings/update', [
            'credit_limit' => 21,
            'passing_score' => 60,
            'drop_window_days' => 7,
            'grade_edit_window_hours' => 24,
            'appeal_window_days' => 10,
        ])->assertOk();

        $this->assertSame(21, Settings::creditLimit());
        $this->assertSame(60, Settings::passingScore());
        $this->assertSame(7, Settings::dropWindowDays());
        $this->assertSame(24, Settings::gradeEditWindowHours());
        $this->assertSame(10, Settings::appealWindowDays());

        $this->assertDatabaseHas('activity_logs', ['action' => 'settings_updated']);
    }
}
