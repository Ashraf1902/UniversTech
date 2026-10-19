<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Attendance;
use App\Models\Course;
use App\Models\Department;
use App\Models\Lecture;
use App\Models\Level;
use App\Models\Payment;
use App\Models\Semester;
use App\Models\StudentCourse;
use App\Models\User;
use App\Services\ImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReportsTest extends TestCase
{
    use RefreshDatabase;

    private Admin $superAdmin;

    private Semester $semester;

    private Department $departmentA;

    private Department $departmentB;

    private Level $levelOne;

    private Level $levelTwo;

    private User $professor;

    private Course $courseA;

    private Course $courseB;

    private User $studentOne;

    private User $studentTwo;

    private User $studentThree;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = Admin::factory()->create(['id' => 1, 'is_super_admin' => true]);
        $this->semester = Semester::create(['name' => 'First', 'academic_year' => '2026/2027', 'is_active' => true]);
        $this->departmentA = Department::factory()->create(['admin_id' => $this->superAdmin->id, 'name' => 'قسم الحاسبات']);
        $this->departmentB = Department::factory()->create(['admin_id' => $this->superAdmin->id]);
        $this->levelOne = Level::factory()->create();
        $this->levelTwo = Level::factory()->create();

        $this->professor = User::factory()->create([
            'type' => User::TYPE_PROFESSOR,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ]);

        $this->courseA = Course::create([
            'course_name' => 'Alpha',
            'course_code' => 'AAA101',
            'no_of_hours' => 3,
            'capacity' => 2,
            'department_id' => $this->departmentA->id,
            'professor_id' => $this->professor->id,
            'admin_id' => $this->superAdmin->id,
            'semester_id' => $this->semester->id,
        ]);

        $this->courseB = Course::create([
            'course_name' => 'Beta',
            'course_code' => 'BBB101',
            'no_of_hours' => 3,
            'capacity' => 10,
            'department_id' => $this->departmentB->id,
            'professor_id' => $this->professor->id,
            'admin_id' => $this->superAdmin->id,
            'semester_id' => $this->semester->id,
        ]);

        $this->studentOne = $this->makeStudent($this->departmentA->id, $this->levelOne->id);
        $this->studentTwo = $this->makeStudent($this->departmentA->id, $this->levelOne->id);
        $this->studentThree = $this->makeStudent($this->departmentB->id, $this->levelTwo->id);

        // Course A: two registered, one dropped.
        $this->enroll($this->studentOne, $this->courseA, StudentCourse::STATUS_REGISTERED);
        $this->enroll($this->studentTwo, $this->courseA, StudentCourse::STATUS_REGISTERED);
        $this->enroll($this->studentThree, $this->courseA, StudentCourse::STATUS_DROPPED);

        // Course B: one registered.
        $this->enroll($this->studentThree, $this->courseB, StudentCourse::STATUS_REGISTERED);
    }

    private function makeStudent(int $departmentId, int $levelId): User
    {
        $user = User::factory()->create([
            'type' => User::TYPE_STUDENT,
            'status' => User::STATUS_ACTIVE,
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

    private function enroll(User $student, Course $course, string $status): StudentCourse
    {
        return StudentCourse::create([
            'student_id' => $student->id,
            'course_id' => $course->id,
            'progress' => 0,
            'status' => $status,
            'status_changed_at' => now(),
            'semester_id' => $this->semester->id,
        ]);
    }

    private function actingAsAdmin(array $roles): Admin
    {
        $admin = Admin::factory()->create(['is_super_admin' => false, 'roles' => $roles]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function rowFor(array $rows, string $key, int $id): array
    {
        return collect($rows)->firstWhere($key, $id);
    }

    public function test_enrollment_report_aggregates_counts_by_status_and_capacity_usage(): void
    {
        $this->actingAsAdmin(['reports']);

        $response = $this->get('/api/report/enrollment')->assertOk();

        $rows = $response->json('data.rows');
        $this->assertCount(2, $rows);

        $alpha = $this->rowFor($rows, 'course_id', $this->courseA->id);
        $this->assertSame(2, $alpha['registered']);
        $this->assertSame(1, $alpha['dropped']);
        $this->assertSame(0, $alpha['completed']);
        $this->assertSame(0, $alpha['failed']);
        $this->assertSame(3, $alpha['total']);
        $this->assertSame(2, $alpha['capacity']);
        $this->assertEquals(100.0, $alpha['capacity_usage']);

        $beta = $this->rowFor($rows, 'course_id', $this->courseB->id);
        $this->assertSame(1, $beta['registered']);
        $this->assertSame(1, $beta['total']);
        $this->assertEquals(10.0, $beta['capacity_usage']);

        $this->assertSame(3, $response->json('data.totals.registered'));
        $this->assertSame(1, $response->json('data.totals.dropped'));
        $this->assertSame(4, $response->json('data.totals.enrollments'));
    }

    public function test_enrollment_report_filters_by_department_and_level(): void
    {
        $this->actingAsAdmin(['reports']);

        $byDepartment = $this->get('/api/report/enrollment?department_id=' . $this->departmentB->id)
            ->assertOk()
            ->json('data.rows');
        $this->assertCount(1, $byDepartment);
        $this->assertSame($this->courseB->id, $byDepartment[0]['course_id']);

        $byLevel = $this->get('/api/report/enrollment?level_id=' . $this->levelOne->id)
            ->assertOk()
            ->json('data.rows');
        $this->assertCount(1, $byLevel);
        $this->assertSame($this->courseA->id, $byLevel[0]['course_id']);
        // The dropped enrollment belonged to a level-two student, so it is filtered out.
        $this->assertSame(2, $byLevel[0]['registered']);
        $this->assertSame(0, $byLevel[0]['dropped']);
    }

    public function test_enrollment_report_excludes_soft_deleted_courses(): void
    {
        $this->courseB->delete();

        $this->actingAsAdmin(['reports']);

        $rows = $this->get('/api/report/enrollment')->assertOk()->json('data.rows');
        $this->assertCount(1, $rows);
        $this->assertSame($this->courseA->id, $rows[0]['course_id']);
    }

    public function test_payments_report_totals_by_status_period_and_department(): void
    {
        $this->makePayment($this->studentOne, 700, Payment::STATUS_PAID, '2026-09-10', '2026-09-15');
        $this->makePayment($this->studentTwo, 700, Payment::STATUS_PENDING, '2026-09-20');
        $this->makePayment($this->studentThree, 575, Payment::STATUS_PAID, '2026-10-01', '2026-10-05');
        $this->makePayment($this->studentOne, 575, Payment::STATUS_WAIVED, '2026-10-10');

        $this->actingAsAdmin(['reports']);

        $response = $this->get('/api/report/payments')->assertOk();

        $this->assertSame(4, $response->json('data.totals.count'));
        $this->assertEquals(1275.0, $response->json('data.totals.collected'));
        $this->assertEquals(700.0, $response->json('data.totals.pending'));
        $this->assertEquals(575.0, $response->json('data.totals.waived'));
        $this->assertEquals(0.0, $response->json('data.totals.refunded'));

        $statuses = collect($response->json('data.by_status'))->keyBy('status');
        $this->assertSame(2, $statuses['paid']['count']);
        $this->assertEquals(1275.0, $statuses['paid']['total']);
        $this->assertSame(1, $statuses['pending']['count']);
        $this->assertSame(1, $statuses['waived']['count']);

        $periods = collect($response->json('data.by_period'))->keyBy('period');
        $this->assertSame(2, $periods['2026-09']['count']);
        $this->assertEquals(700.0, $periods['2026-09']['collected']);
        $this->assertSame(2, $periods['2026-10']['count']);
        $this->assertEquals(575.0, $periods['2026-10']['collected']);

        $departments = collect($response->json('data.by_department'))->keyBy('department');
        $this->assertSame(3, $departments[$this->departmentA->name]['count']);
        $this->assertEquals(700.0, $departments[$this->departmentA->name]['collected']);
        $this->assertSame(1, $departments[$this->departmentB->name]['count']);
        $this->assertEquals(575.0, $departments[$this->departmentB->name]['collected']);
    }

    public function test_payments_report_filters_by_date_range(): void
    {
        $this->makePayment($this->studentOne, 700, Payment::STATUS_PAID, '2026-09-10', '2026-09-15');
        $this->makePayment($this->studentTwo, 700, Payment::STATUS_PENDING, '2026-09-20');
        $this->makePayment($this->studentThree, 575, Payment::STATUS_PAID, '2026-10-01', '2026-10-05');
        $this->makePayment($this->studentOne, 575, Payment::STATUS_WAIVED, '2026-10-10');

        $this->actingAsAdmin(['reports']);

        $response = $this->get('/api/report/payments?date_from=2026-10-01&date_to=2026-10-31')->assertOk();

        $this->assertSame(2, $response->json('data.totals.count'));
        $this->assertEquals(575.0, $response->json('data.totals.collected'));
        $this->assertEquals(575.0, $response->json('data.totals.waived'));
    }

    public function test_payments_report_excludes_soft_deleted_payments_and_users(): void
    {
        $paid = $this->makePayment($this->studentOne, 700, Payment::STATUS_PAID, '2026-09-10', '2026-09-15');
        $this->makePayment($this->studentTwo, 700, Payment::STATUS_PAID, '2026-09-11', '2026-09-16');
        $paid->delete();

        $this->studentThree->delete(); // soft delete + its payment
        $this->makePayment($this->studentThree, 575, Payment::STATUS_PAID, '2026-10-01', '2026-10-05');

        $this->actingAsAdmin(['reports']);

        $response = $this->get('/api/report/payments')->assertOk();

        $this->assertSame(1, $response->json('data.totals.count'));
        $this->assertEquals(700.0, $response->json('data.totals.collected'));
    }

    public function test_attendance_report_summarises_per_course_and_level_with_thresholds(): void
    {
        $lectureA = Lecture::create(['name' => 'Lecture 1', 'content' => 'a.pdf', 'course_id' => $this->courseA->id]);

        // studentOne: 3 present, 1 absent = 25% (barred at the 25% bar threshold).
        $this->makeAttendance($this->studentOne, $this->courseA, $lectureA, '2026-09-01', true);
        $this->makeAttendance($this->studentOne, $this->courseA, $lectureA, '2026-09-08', true);
        $this->makeAttendance($this->studentOne, $this->courseA, $lectureA, '2026-09-15', true);
        $this->makeAttendance($this->studentOne, $this->courseA, $lectureA, '2026-09-22', false);

        // studentTwo: 3 present, 1 absent, but the absent row is soft-deleted.
        $this->makeAttendance($this->studentTwo, $this->courseA, $lectureA, '2026-09-01', true);
        $this->makeAttendance($this->studentTwo, $this->courseA, $lectureA, '2026-09-08', true);
        $this->makeAttendance($this->studentTwo, $this->courseA, $lectureA, '2026-09-15', true);
        $deleted = $this->makeAttendance($this->studentTwo, $this->courseA, $lectureA, '2026-09-22', false);
        $deleted->delete();

        $this->actingAsAdmin(['reports']);

        $response = $this->get('/api/report/attendance')->assertOk();

        $courseRow = $this->rowFor($response->json('data.rows'), 'course_id', $this->courseA->id);
        $this->assertNotNull($courseRow);
        $this->assertSame(4, $courseRow['sessions']);
        $this->assertSame(7, $courseRow['records']);
        $this->assertSame(6, $courseRow['present']);
        $this->assertSame(1, $courseRow['absent']);
        $this->assertEquals(14.29, $courseRow['absence_percentage']);

        $levels = collect($response->json('data.levels'))->keyBy('level');
        $this->assertSame(7, $levels[$this->levelOne->name]['records']);
        $this->assertSame(1, $levels[$this->levelOne->name]['absent']);

        $this->assertSame(15, $response->json('data.thresholds.warn'));
        $this->assertSame(25, $response->json('data.thresholds.bar'));

        $over = collect($response->json('data.students_over_threshold'));
        $this->assertCount(1, $over);
        $this->assertSame($this->studentOne->id, $over[0]['student_id']);
        $this->assertEquals(25.0, $over[0]['absence_percentage']);
        $this->assertSame('barred', $over[0]['status']);
    }

    public function test_attendance_report_filters_by_course(): void
    {
        $lectureA = Lecture::create(['name' => 'Lecture 1', 'content' => 'a.pdf', 'course_id' => $this->courseA->id]);
        $lectureB = Lecture::create(['name' => 'Lecture 1', 'content' => 'b.pdf', 'course_id' => $this->courseB->id]);

        $this->makeAttendance($this->studentOne, $this->courseA, $lectureA, '2026-09-01', true);
        $this->makeAttendance($this->studentThree, $this->courseB, $lectureB, '2026-09-01', false);

        $this->actingAsAdmin(['reports']);

        $rows = $this->get('/api/report/attendance?course_id=' . $this->courseA->id)->assertOk()->json('data.rows');

        $this->assertCount(1, $rows);
        $this->assertSame($this->courseA->id, $rows[0]['course_id']);
    }

    public function test_reports_require_the_reports_scope(): void
    {
        $this->actingAsAdmin(['courses']);

        $this->get('/api/report/enrollment')->assertStatus(403);
        $this->get('/api/report/payments')->assertStatus(403);
        $this->get('/api/report/attendance')->assertStatus(403);
        $this->get('/api/report/unassigned')->assertStatus(403);
    }

    public function test_a_super_admin_can_view_reports(): void
    {
        Sanctum::actingAs($this->superAdmin);

        $this->get('/api/report/enrollment')->assertOk();
        $this->get('/api/report/payments')->assertOk();
        $this->get('/api/report/attendance')->assertOk();
        $this->get('/api/report/unassigned')->assertOk();
    }

    public function test_unassigned_report_lists_courses_and_enrollments_without_a_semester(): void
    {
        $orphanCourse = Course::create([
            'course_name' => 'Gamma',
            'course_code' => 'CCC101',
            'no_of_hours' => 3,
            'capacity' => 5,
            'department_id' => $this->departmentA->id,
            'professor_id' => $this->professor->id,
            'admin_id' => $this->superAdmin->id,
            'semester_id' => null,
        ]);

        $orphanEnrollment = StudentCourse::create([
            'student_id' => $this->studentOne->id,
            'course_id' => $orphanCourse->id,
            'progress' => 0,
            'status' => StudentCourse::STATUS_REGISTERED,
            'status_changed_at' => now(),
            'semester_id' => null,
        ]);

        $this->actingAsAdmin(['reports']);

        $response = $this->get('/api/report/unassigned')->assertOk();

        $this->assertSame(1, $response->json('data.totals.courses'));
        $this->assertSame(1, $response->json('data.totals.enrollments'));

        $courses = collect($response->json('data.courses'));
        $this->assertCount(1, $courses);
        $this->assertSame($orphanCourse->id, $courses[0]['id']);
        $this->assertSame('Gamma', $courses[0]['course_name']);

        $enrollments = collect($response->json('data.enrollments'));
        $this->assertCount(1, $enrollments);
        $this->assertSame($orphanEnrollment->id, $enrollments[0]['id']);
        $this->assertSame($this->studentOne->id, $enrollments[0]['student_id']);
        $this->assertSame($orphanCourse->id, $enrollments[0]['course_id']);
    }

    public function test_reports_can_be_exported_to_csv(): void
    {
        $this->makePayment($this->studentOne, 700, Payment::STATUS_PAID, '2026-09-10', '2026-09-15');

        $this->actingAsAdmin(['reports']);

        $response = $this->get('/api/report/payments?export=csv')->assertOk();
        $this->assertStringContainsString('text/csv', $response->headers->get('content-type'));

        $body = $response->streamedContent();
        $this->assertStringStartsWith(ImportService::BOM, $body);
        $this->assertStringContainsString('Period,Payments,Total,Collected', $body);
        $this->assertStringContainsString('2026-09', $body);
    }

    public function test_enrollment_export_preserves_arabic_department_names(): void
    {
        $this->actingAsAdmin(['reports']);

        $response = $this->get('/api/report/enrollment?export=csv')->assertOk();
        $this->assertStringContainsString('text/csv', $response->headers->get('content-type'));

        $body = $response->streamedContent();
        $this->assertStringStartsWith(ImportService::BOM, $body);
        $this->assertStringContainsString('قسم الحاسبات', $body);
        $this->assertStringContainsString('Alpha', $body);
    }

    private function makePayment(User $student, float $amount, string $status, string $createdAt, ?string $paidAt = null): Payment
    {
        return Payment::forceCreate([
            'user_id' => $student->id,
            'amount' => $amount,
            'type' => Payment::TYPE_COURSES,
            'status' => $status,
            'semester_id' => $this->semester->id,
            'created_at' => $createdAt . ' 09:00:00',
            'paid_at' => $paidAt ? $paidAt . ' 09:00:00' : null,
        ]);
    }

    private function makeAttendance(User $student, Course $course, Lecture $lecture, string $date, bool $present): Attendance
    {
        return Attendance::create([
            'date' => $date,
            'status' => $present,
            'student_id' => $student->id,
            'professor_id' => $this->professor->id,
            'lec_id' => $lecture->id,
            'course_id' => $course->id,
        ]);
    }
}
