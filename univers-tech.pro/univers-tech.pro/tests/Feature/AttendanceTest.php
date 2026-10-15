<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Attendance;
use App\Models\AttendanceThresholdAlert;
use App\Models\Course;
use App\Models\Department;
use App\Models\Lecture;
use App\Models\Level;
use App\Models\Semester;
use App\Models\StudentCourse;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AttendanceTest extends TestCase
{
    use RefreshDatabase;

    private Admin $superAdmin;
    private Department $department;
    private Semester $semester;
    private Level $level;
    private User $professor;
    private User $student;
    private Course $course;
    private Lecture $lecture;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = Admin::factory()->create(['id' => 1, 'is_super_admin' => true]);
        $this->department = Department::factory()->create(['admin_id' => $this->superAdmin->id]);
        $this->level = Level::factory()->create();
        $this->semester = Semester::create([
            'name' => 'Fall',
            'academic_year' => '2026',
            'is_active' => true,
        ]);

        $this->professor = User::factory()->create([
            'type' => User::TYPE_PROFESSOR,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ]);

        $this->student = User::factory()->create([
            'type' => User::TYPE_STUDENT,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => $this->level->id,
        ]);
        $this->student->student()->create([
            'department_id' => $this->department->id,
            'level_id' => $this->level->id,
            'semester' => 'first',
            'credit_points' => 0,
        ]);

        $this->course = Course::create([
            'course_name' => 'Algorithms',
            'course_code' => 'CS101',
            'no_of_hours' => 3,
            'cover_image' => 'default.jpg',
            'department_id' => $this->department->id,
            'professor_id' => $this->professor->id,
            'admin_id' => $this->superAdmin->id,
            'semester_id' => $this->semester->id,
        ]);

        StudentCourse::create([
            'student_id' => $this->student->id,
            'course_id' => $this->course->id,
            'status' => StudentCourse::STATUS_REGISTERED,
            'semester_id' => $this->semester->id,
        ]);

        $this->lecture = Lecture::create([
            'name' => 'Intro',
            'content' => 'lectures/intro.pdf',
            'course_id' => $this->course->id,
        ]);
    }

    private function actingAsAdmin(array $roles = [], bool $super = false): Admin
    {
        $admin = $super
            ? $this->superAdmin
            : Admin::factory()->create(['is_super_admin' => false, 'roles' => $roles]);

        Sanctum::actingAs($admin);

        return $admin;
    }

    private function adminStore(bool $status, ?int $lectureId = null): void
    {
        $this->postJson('/api/attendance/store', [
            'student_id' => $this->student->id,
            'lecture_id' => $lectureId ?? $this->lecture->id,
            'date' => now()->toDateString(),
            'status' => $status,
        ])->assertStatus(201);
    }

    private function makeLectures(int $count): array
    {
        $lectures = [];
        for ($i = 1; $i <= $count; $i++) {
            $lectures[] = Lecture::create([
                'name' => 'Lecture ' . $i,
                'content' => 'lectures/' . $i . '.pdf',
                'course_id' => $this->course->id,
            ]);
        }

        return $lectures;
    }

    public function test_admin_without_attendances_scope_is_rejected(): void
    {
        $this->actingAsAdmin(roles: ['courses']);
        $this->getJson('/api/attendance/get/all')->assertStatus(403);
        $this->postJson('/api/attendance/store', [
            'student_id' => $this->student->id,
            'lecture_id' => $this->lecture->id,
            'date' => now()->toDateString(),
            'status' => true,
        ])->assertStatus(403);
    }

    public function test_admin_with_attendances_scope_can_list_attendance(): void
    {
        $this->actingAsAdmin(roles: ['attendances']);
        $this->getJson('/api/attendance/get/all')->assertOk()->assertJsonPath('status', 200);
    }

    public function test_professor_and_student_cannot_access_admin_attendance_routes(): void
    {
        Sanctum::actingAs($this->professor);
        $this->getJson('/api/attendance/get/all')->assertStatus(403);

        Sanctum::actingAs($this->student);
        $this->getJson('/api/attendance/get/all')->assertStatus(403);
    }

    public function test_admin_attendance_write_records_the_admin_as_the_recorder(): void
    {
        $admin = $this->actingAsAdmin(super: true);
        $this->adminStore(true);

        $attendance = Attendance::firstOrFail();
        $this->assertSame(Admin::class, $attendance->recorded_by_type);
        $this->assertSame($admin->id, $attendance->recorded_by_id);
        $this->assertSame($admin->id, $attendance->recordedBy->id);
    }

    public function test_admin_attendance_override_returns_previous_values_and_is_audited(): void
    {
        $this->actingAsAdmin(super: true);
        $this->adminStore(true);
        $attendance = Attendance::firstOrFail();

        $response = $this->postJson('/api/attendance/update', [
            'attendance_id' => $attendance->id,
            'student_id' => $this->student->id,
            'lecture_id' => $this->lecture->id,
            'date' => $attendance->date->format('Y-m-d'),
            'status' => false,
            'reason' => 'Corrected after appeal',
        ])->assertOk();

        $this->assertTrue($response->json('data.previous.status'));
        $this->assertFalse($response->json('data.attendance.status'));

        $log = DB::table('activity_logs')
            ->where('action', 'updated')
            ->where('subject_type', Attendance::class)
            ->where('subject_id', $attendance->id)
            ->first();

        $this->assertNotNull($log);
        $this->assertSame(Admin::class, $log->actor_type);

        $properties = json_decode($log->properties, true);
        $this->assertTrue((bool) $properties['old']['status']);
        $this->assertFalse((bool) $properties['attributes']['status']);
    }

    public function test_admin_can_archive_and_restore_attendance(): void
    {
        $this->actingAsAdmin(super: true);
        $this->adminStore(true);
        $attendance = Attendance::firstOrFail();

        $this->deleteJson('/api/attendance/delete/' . $attendance->id)->assertOk();
        $this->assertSoftDeleted('attendances', ['id' => $attendance->id]);
        $this->getJson('/api/attendance/get/all')->assertOk()->assertJsonPath('data.total', 0);
        $this->getJson('/api/attendance/get/all?deleted=1')->assertOk()->assertJsonPath('data.total', 1);

        $this->postJson('/api/attendance/restore/' . $attendance->id)->assertOk();
        $this->assertDatabaseHas('attendances', ['id' => $attendance->id, 'deleted_at' => null]);
        $this->assertDatabaseHas('activity_logs', ['action' => 'restored', 'subject_type' => Attendance::class]);
    }

    public function test_professor_attendance_write_records_the_professor_as_the_recorder(): void
    {
        Sanctum::actingAs($this->professor);
        $this->postJson('/api/professors/make/attendance', [
            'date' => now()->toDateString(),
            'status' => true,
            'student_id' => $this->student->id,
            'lecture_id' => $this->lecture->id,
        ])->assertStatus(201);

        $attendance = Attendance::firstOrFail();
        $this->assertSame(User::class, $attendance->recorded_by_type);
        $this->assertSame($this->professor->id, $attendance->recorded_by_id);
    }

    public function test_professor_can_correct_own_attendance_within_the_edit_window(): void
    {
        Sanctum::actingAs($this->professor);
        $this->postJson('/api/professors/make/attendance', [
            'date' => now()->toDateString(),
            'status' => false,
            'student_id' => $this->student->id,
            'lecture_id' => $this->lecture->id,
        ])->assertStatus(201);

        $attendance = Attendance::firstOrFail();

        $this->postJson('/api/professors/update/attendance', [
            'attendance_id' => $attendance->id,
            'date' => now()->toDateString(),
            'status' => true,
            'reason' => 'Late but present',
        ])->assertOk();

        $this->assertTrue($attendance->fresh()->status);
    }

    public function test_professor_cannot_correct_attendance_after_the_edit_window(): void
    {
        Sanctum::actingAs($this->professor);
        $this->postJson('/api/professors/make/attendance', [
            'date' => now()->toDateString(),
            'status' => false,
            'student_id' => $this->student->id,
            'lecture_id' => $this->lecture->id,
        ])->assertStatus(201);

        $attendance = Attendance::firstOrFail();
        Attendance::where('id', $attendance->id)->update(['created_at' => now()->subHours(49)]);

        $this->postJson('/api/professors/update/attendance', [
            'attendance_id' => $attendance->id,
            'date' => now()->toDateString(),
            'status' => true,
        ])->assertStatus(403)->assertJsonPath('message', 'The attendance correction window (48 hours) has passed. Only an administrator can change this record now.');

        $this->assertFalse((bool) $attendance->fresh()->status);
    }

    public function test_non_owner_professor_cannot_correct_attendance(): void
    {
        Sanctum::actingAs($this->professor);
        $this->postJson('/api/professors/make/attendance', [
            'date' => now()->toDateString(),
            'status' => false,
            'student_id' => $this->student->id,
            'lecture_id' => $this->lecture->id,
        ])->assertStatus(201);

        $attendance = Attendance::firstOrFail();

        $intruder = User::factory()->create([
            'type' => User::TYPE_PROFESSOR,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ]);

        Sanctum::actingAs($intruder);
        $this->postJson('/api/professors/update/attendance', [
            'attendance_id' => $attendance->id,
            'date' => now()->toDateString(),
            'status' => true,
        ])->assertStatus(403);
    }

    public function test_admin_can_correct_attendance_after_the_professor_window_closed(): void
    {
        Sanctum::actingAs($this->professor);
        $this->postJson('/api/professors/make/attendance', [
            'date' => now()->toDateString(),
            'status' => false,
            'student_id' => $this->student->id,
            'lecture_id' => $this->lecture->id,
        ])->assertStatus(201);

        $attendance = Attendance::firstOrFail();
        Attendance::where('id', $attendance->id)->update(['created_at' => now()->subHours(49)]);

        $this->actingAsAdmin(super: true);
        $this->postJson('/api/attendance/update', [
            'attendance_id' => $attendance->id,
            'student_id' => $this->student->id,
            'lecture_id' => $this->lecture->id,
            'date' => now()->toDateString(),
            'status' => true,
        ])->assertOk();

        $this->assertTrue($attendance->fresh()->status);
    }

    public function test_roster_returns_registered_students_with_absence_summary(): void
    {
        $this->actingAsAdmin(roles: ['attendances']);
        $this->adminStore(true);

        $response = $this->getJson('/api/attendance/roster?course_id=' . $this->course->id . '&lecture_id=' . $this->lecture->id)
            ->assertOk()
            ->assertJsonPath('data.0.id', $this->student->id)
            ->assertJsonPath('data.0.present', true)
            ->assertJsonPath('data.0.status', 'ok')
            ->assertJsonPath('data.0.warn_threshold', 15)
            ->assertJsonPath('data.0.bar_threshold', 25);

        $this->assertEqualsWithDelta(0.0, $response->json('data.0.absence_percentage'), 0.001);
    }

    public function test_student_attendance_view_returns_counts_and_absence_percentage(): void
    {
        $lectures = $this->makeLectures(6);
        foreach ($lectures as $index => $lecture) {
            Attendance::create([
                'date' => now()->toDateString(),
                'status' => $index !== 0,
                'student_id' => $this->student->id,
                'professor_id' => $this->professor->id,
                'lec_id' => $lecture->id,
                'course_id' => $this->course->id,
            ]);
        }

        Sanctum::actingAs($this->student);
        $response = $this->getJson('/api/user/attendance')->assertOk();

        $course = $response->json('data.courses.0');
        $this->assertSame($this->course->id, $course['course_id']);
        $this->assertSame(6, $course['total']);
        $this->assertSame(5, $course['present']);
        $this->assertSame(1, $course['absent']);
        $this->assertSame(16.67, $course['absence_percentage']);
        $this->assertSame('warning', $course['status']);
        $this->assertCount(6, $course['records']);
        $this->assertSame(15, $response->json('data.thresholds.warn'));
        $this->assertSame(25, $response->json('data.thresholds.bar'));
    }

    public function test_absence_threshold_notifications_are_sent_exactly_once(): void
    {
        $lectures = $this->makeLectures(7);

        // 6 records with 1 absence => 16.67% (warn 15%, below bar 25%).
        foreach (array_slice($lectures, 0, 6) as $index => $lecture) {
            Attendance::create([
                'date' => now()->toDateString(),
                'status' => $index !== 5,
                'student_id' => $this->student->id,
                'professor_id' => $this->professor->id,
                'lec_id' => $lecture->id,
                'course_id' => $this->course->id,
            ]);
        }

        Sanctum::actingAs($this->student);
        $this->getJson('/api/user/attendance')->assertOk();

        $warnTitle = 'Absence warning';
        $barTitle = 'Exam bar: absence threshold reached';

        $this->assertSame(1, DB::table('notifications')->where('student_id', $this->student->id)->where('title', $warnTitle)->count());
        $this->assertSame(0, DB::table('notifications')->where('student_id', $this->student->id)->where('title', $barTitle)->count());

        // Repeated reads must not re-send the warning.
        $this->getJson('/api/user/attendance')->assertOk();
        $this->getJson('/api/user/attendance')->assertOk();
        $this->assertSame(1, DB::table('notifications')->where('student_id', $this->student->id)->where('title', $warnTitle)->count());

        $this->assertSame(1, AttendanceThresholdAlert::where('threshold', 'warn')->count());
        $this->assertSame(0, AttendanceThresholdAlert::where('threshold', 'bar')->count());

        // A 7th record (absent) pushes absence to 28.57% => barred.
        Attendance::create([
            'date' => now()->toDateString(),
            'status' => false,
            'student_id' => $this->student->id,
            'professor_id' => $this->professor->id,
            'lec_id' => $lectures[6]->id,
            'course_id' => $this->course->id,
        ]);

        $this->getJson('/api/user/attendance')->assertOk();
        $this->getJson('/api/user/attendance')->assertOk();

        $this->assertSame(1, DB::table('notifications')->where('student_id', $this->student->id)->where('title', $barTitle)->count());
        $this->assertSame(1, DB::table('notifications')->where('student_id', $this->student->id)->where('title', $warnTitle)->count());
        $this->assertSame(1, AttendanceThresholdAlert::where('threshold', 'bar')->count());

        Sanctum::actingAs($this->student);
        $course = $this->getJson('/api/user/attendance')->json('data.courses.0');
        $this->assertSame('barred', $course['status']);
        $this->assertSame(28.57, $course['absence_percentage']);
    }

    public function test_threshold_notifications_fire_when_the_admin_records_attendance(): void
    {
        $lectures = $this->makeLectures(7);

        $this->actingAsAdmin(roles: ['attendances']);
        foreach ($lectures as $index => $lecture) {
            $this->postJson('/api/attendance/store', [
                'student_id' => $this->student->id,
                'lecture_id' => $lecture->id,
                'date' => now()->toDateString(),
                'status' => $index !== 5 && $index !== 6,
            ])->assertStatus(201);
        }

        // 2 absences out of 7 => 28.57% => both warn and bar were crossed.
        $this->assertSame(1, DB::table('notifications')->where('student_id', $this->student->id)->where('title', 'Absence warning')->count());
        $this->assertSame(1, DB::table('notifications')->where('student_id', $this->student->id)->where('title', 'Exam bar: absence threshold reached')->count());
        $this->assertSame(2, AttendanceThresholdAlert::where('student_id', $this->student->id)->count());
    }

    public function test_settings_endpoint_persists_attendance_policy_values(): void
    {
        Sanctum::actingAs($this->superAdmin);

        $this->postJson('/api/settings/update', [
            'credit_limit' => 21,
            'passing_score' => 60,
            'drop_window_days' => 7,
            'grade_edit_window_hours' => 24,
            'appeal_window_days' => 10,
            'attendance_edit_window_hours' => 72,
            'attendance_warn_threshold' => 20,
            'attendance_bar_threshold' => 40,
        ])->assertOk()->assertJsonPath('data.attendance_edit_window_hours', 72);

        $this->assertSame(72, \App\Support\Settings::attendanceEditWindowHours());
        $this->assertSame(20, \App\Support\Settings::attendanceWarnThreshold());
        $this->assertSame(40, \App\Support\Settings::attendanceBarThreshold());
    }

    public function test_settings_reject_bar_threshold_below_warn_threshold(): void
    {
        Sanctum::actingAs($this->superAdmin);

        $this->postJson('/api/settings/update', [
            'credit_limit' => 21,
            'passing_score' => 60,
            'drop_window_days' => 7,
            'grade_edit_window_hours' => 24,
            'appeal_window_days' => 10,
            'attendance_warn_threshold' => 40,
            'attendance_bar_threshold' => 20,
        ])->assertStatus(422);
    }
}
