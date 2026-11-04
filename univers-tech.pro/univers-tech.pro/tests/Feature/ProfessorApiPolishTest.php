<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Announcement;
use App\Models\Attendance;
use App\Models\Course;
use App\Models\Department;
use App\Models\Lecture;
use App\Models\Level;
use App\Models\Quiz;
use App\Models\StudentCourse;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProfessorApiPolishTest extends TestCase
{
    use RefreshDatabase;

    private Admin $admin;

    private Department $department;

    private Level $level;

    private User $professorA;

    private User $professorB;

    private User $student1;

    private User $student2;

    private User $outsider;

    private Course $courseA;

    private Lecture $lectureA;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = Admin::factory()->create(['id' => 1, 'is_super_admin' => true]);
        $this->department = Department::factory()->create(['id' => 1, 'admin_id' => $this->admin->id]);
        $this->level = Level::factory()->create(['id' => 1]);

        $this->professorA = User::factory()->create([
            'type' => User::TYPE_PROFESSOR,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->admin->id,
            'department_id' => null,
            'level_id' => null,
        ]);
        $this->professorB = User::factory()->create([
            'type' => User::TYPE_PROFESSOR,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->admin->id,
            'department_id' => null,
            'level_id' => null,
        ]);

        $this->courseA = Course::create([
            'course_name' => 'Algorithms',
            'course_code' => 'CS101',
            'no_of_hours' => 3,
            'department_id' => $this->department->id,
            'professor_id' => $this->professorA->id,
            'admin_id' => $this->admin->id,
        ]);

        $this->student1 = $this->makeStudent('Sara One');
        $this->student2 = $this->makeStudent('Sara Two');
        $this->outsider = $this->makeStudent('Outside Student');

        StudentCourse::create([
            'student_id' => $this->student1->id,
            'course_id' => $this->courseA->id,
            'status' => StudentCourse::STATUS_REGISTERED,
        ]);
        StudentCourse::create([
            'student_id' => $this->student2->id,
            'course_id' => $this->courseA->id,
            'status' => StudentCourse::STATUS_REGISTERED,
        ]);

        $this->lectureA = Lecture::create([
            'name' => 'Intro',
            'content' => 'lectures/intro.pdf',
            'course_id' => $this->courseA->id,
        ]);
    }

    private function makeStudent(string $name): User
    {
        $student = User::factory()->create([
            'name' => $name,
            'type' => User::TYPE_STUDENT,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->admin->id,
            'department_id' => null,
            'level_id' => $this->level->id,
        ]);

        $student->student()->create([
            'department_id' => $this->department->id,
            'level_id' => $this->level->id,
            'semester' => 'first',
            'credit_points' => 0,
        ]);

        return $student;
    }

    private function bulkPayload(array $rows, ?int $lectureId = null): array
    {
        return [
            'lecture_id' => $lectureId ?? $this->lectureA->id,
            'date' => now()->toDateString(),
            'attendances' => $rows,
        ];
    }

    public function test_bulk_attendance_saves_a_whole_class(): void
    {
        Sanctum::actingAs($this->professorA);

        $this->postJson('/api/professors/attendance/bulk', $this->bulkPayload([
            ['student_id' => $this->student1->id, 'status' => true],
            ['student_id' => $this->student2->id, 'status' => false, 'reason' => 'Sick'],
        ]))
            ->assertOk()
            ->assertJsonPath('status', 200)
            ->assertJsonPath('data.created', 2)
            ->assertJsonPath('data.updated', 0)
            ->assertJsonPath('data.total', 2);

        $this->assertSame(2, Attendance::where('lec_id', $this->lectureA->id)->count());

        $row = Attendance::where('student_id', $this->student2->id)->firstOrFail();
        $this->assertFalse((bool) $row->status);
        $this->assertSame('Sick', $row->reason);
        $this->assertSame($this->courseA->id, $row->course_id);
        $this->assertSame($this->professorA->id, $row->professor_id);
        $this->assertSame(User::class, $row->recorded_by_type);
        $this->assertSame($this->professorA->id, $row->recorded_by_id);
    }

    public function test_bulk_attendance_updates_existing_records_instead_of_duplicating(): void
    {
        $existing = Attendance::create([
            'date' => now()->toDateString(),
            'status' => true,
            'student_id' => $this->student1->id,
            'professor_id' => $this->professorA->id,
            'lec_id' => $this->lectureA->id,
            'course_id' => $this->courseA->id,
        ]);

        Sanctum::actingAs($this->professorA);

        $this->postJson('/api/professors/attendance/bulk', $this->bulkPayload([
            ['student_id' => $this->student1->id, 'status' => false, 'reason' => 'Corrected'],
            ['student_id' => $this->student2->id, 'status' => true],
        ]))
            ->assertOk()
            ->assertJsonPath('data.created', 1)
            ->assertJsonPath('data.updated', 1);

        $this->assertSame(2, Attendance::where('lec_id', $this->lectureA->id)->count());
        $this->assertFalse((bool) $existing->fresh()->status);
        $this->assertSame('Corrected', $existing->fresh()->reason);
    }

    public function test_another_professor_cannot_bulk_save_attendance(): void
    {
        Sanctum::actingAs($this->professorB);

        $this->postJson('/api/professors/attendance/bulk', $this->bulkPayload([
            ['student_id' => $this->student1->id, 'status' => true],
        ]))->assertStatus(403);

        $this->assertSame(0, Attendance::count());
    }

    public function test_bulk_attendance_refuses_a_student_who_is_not_enrolled(): void
    {
        Sanctum::actingAs($this->professorA);

        $response = $this->postJson('/api/professors/attendance/bulk', $this->bulkPayload([
            ['student_id' => $this->outsider->id, 'status' => true],
        ]))
            ->assertStatus(422)
            ->assertJsonPath('status', 422);

        $this->assertStringContainsString((string) $this->outsider->id, (string) $response->json('message'));
        $this->assertSame(0, Attendance::count());
    }

    public function test_bulk_attendance_is_atomic_when_the_payload_contains_a_bad_row(): void
    {
        $existing = Attendance::create([
            'date' => now()->toDateString(),
            'status' => true,
            'student_id' => $this->student1->id,
            'professor_id' => $this->professorA->id,
            'lec_id' => $this->lectureA->id,
            'course_id' => $this->courseA->id,
        ]);

        Sanctum::actingAs($this->professorA);

        $this->postJson('/api/professors/attendance/bulk', $this->bulkPayload([
            ['student_id' => $this->student2->id, 'status' => true],
            ['student_id' => $this->outsider->id, 'status' => true],
        ]))->assertStatus(422);

        // The valid row must not be written and the existing row must be untouched.
        $this->assertSame(1, Attendance::count());
        $this->assertTrue((bool) $existing->fresh()->status);
        $this->assertNull(Attendance::where('student_id', $this->student2->id)->first());
    }

    public function test_bulk_attendance_rejects_duplicate_students(): void
    {
        Sanctum::actingAs($this->professorA);

        $this->postJson('/api/professors/attendance/bulk', $this->bulkPayload([
            ['student_id' => $this->student1->id, 'status' => true],
            ['student_id' => $this->student1->id, 'status' => false],
        ]))->assertStatus(422);

        $this->assertSame(0, Attendance::count());
    }

    public function test_bulk_attendance_refuses_records_outside_the_correction_window(): void
    {
        $existing = Attendance::create([
            'date' => now()->toDateString(),
            'status' => true,
            'student_id' => $this->student1->id,
            'professor_id' => $this->professorA->id,
            'lec_id' => $this->lectureA->id,
            'course_id' => $this->courseA->id,
        ]);
        Attendance::where('id', $existing->id)->update(['created_at' => now()->subHours(49)]);

        Sanctum::actingAs($this->professorA);

        $this->postJson('/api/professors/attendance/bulk', $this->bulkPayload([
            ['student_id' => $this->student1->id, 'status' => false],
        ]))->assertStatus(403);

        $this->assertTrue((bool) $existing->fresh()->status);
    }

    public function test_bulk_attendance_rejects_payloads_over_the_size_cap(): void
    {
        $rows = [];
        for ($i = 0; $i < 201; $i++) {
            $rows[] = ['student_id' => $this->student1->id, 'status' => true];
        }

        Sanctum::actingAs($this->professorA);

        $this->postJson('/api/professors/attendance/bulk', $this->bulkPayload($rows))->assertStatus(422);
        $this->assertSame(0, Attendance::count());
    }

    public function test_courses_list_includes_students_count_and_pagination_info(): void
    {
        $extra = Course::create([
            'course_name' => 'Databases',
            'course_code' => 'CS202',
            'no_of_hours' => 3,
            'department_id' => $this->department->id,
            'professor_id' => $this->professorA->id,
            'admin_id' => $this->admin->id,
        ]);
        StudentCourse::create([
            'student_id' => $this->outsider->id,
            'course_id' => $extra->id,
            'status' => StudentCourse::STATUS_REGISTERED,
        ]);
        // A dropped student must not be counted.
        StudentCourse::create([
            'student_id' => $this->student1->id,
            'course_id' => $extra->id,
            'status' => StudentCourse::STATUS_DROPPED,
        ]);

        Sanctum::actingAs($this->professorA);

        $response = $this->getJson('/api/professors/courses')->assertOk();

        $rows = collect($response->json('data.data'))->keyBy('id');
        $this->assertSame(2, $rows[$this->courseA->id]['students_count']);
        $this->assertSame(1, $rows[$extra->id]['students_count']);
        $this->assertSame(2, $response->json('data.total'));

        $this->getJson('/api/professors/courses?per_page=1')
            ->assertOk()
            ->assertJsonPath('data.per_page', 1)
            ->assertJsonPath('data.last_page', 2)
            ->assertJsonPath('data.total', 2);
    }

    public function test_announcement_list_uses_the_store_payload_shape(): void
    {
        $announcement = Announcement::create([
            'course_id' => $this->courseA->id,
            'professor_id' => $this->professorA->id,
            'title' => 'Midterm update',
            'body' => 'Room changed.',
            'attachment' => 'announcements/notice.pdf',
        ]);

        Sanctum::actingAs($this->professorA);

        $row = $this->getJson('/api/professor/announcement/get/all')
            ->assertOk()
            ->assertJsonPath('data.data.0.id', $announcement->id)
            ->assertJsonPath('data.data.0.course_name', 'Algorithms')
            ->assertJsonPath('data.data.0.course_code', 'CS101')
            ->json('data.data.0');

        $this->assertSame($this->courseA->id, $row['course_id']);
        $this->assertStringStartsWith('http', $row['attachment']);
        $this->assertStringContainsString('uploads/announcements/notice.pdf', $row['attachment']);
        $this->assertArrayHasKey('author', $row);
    }

    public function test_quiz_list_includes_course_name_and_code(): void
    {
        Quiz::create([
            'name' => 'Quiz 1',
            'content' => 'quizzes/quiz1.pdf',
            'course_id' => $this->courseA->id,
        ]);

        Sanctum::actingAs($this->professorA);

        $this->getJson('/api/quiz/get/all/' . $this->courseA->id)
            ->assertOk()
            ->assertJsonPath('data.data.0.course_id', $this->courseA->id)
            ->assertJsonPath('data.data.0.course_name', 'Algorithms')
            ->assertJsonPath('data.data.0.course_code', 'CS101');
    }
}
