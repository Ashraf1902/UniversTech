<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Course;
use App\Models\Department;
use App\Models\Level;
use App\Models\Payment;
use App\Models\Schedule;
use App\Models\Semester;
use App\Models\StudentCourse;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StudentScheduleTest extends TestCase
{
    use RefreshDatabase;

    private Admin $superAdmin;

    private Department $department;

    private Level $level;

    private Semester $semester;

    private User $student;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = Admin::factory()->create(['id' => 1, 'is_super_admin' => true]);
        $this->department = Department::factory()->create(['admin_id' => $this->superAdmin->id]);
        $this->level = Level::factory()->create();

        $this->semester = Semester::create([
            'name' => 'Current',
            'academic_year' => '2026-2027',
            'is_active' => true,
        ]);

        $this->student = User::factory()->create([
            'type' => User::TYPE_STUDENT,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ]);

        $this->student->student()->create([
            'department_id' => $this->department->id,
            'level_id' => $this->level->id,
            'semester' => 'first',
            'credit_points' => 0,
        ]);

        $this->unlockCourses();
    }

    private function unlockCourses(): void
    {
        Payment::forceCreate([
            'user_id' => $this->student->id,
            'semester_id' => $this->semester->id,
            'amount' => Payment::PRICE_COURSES,
            'type' => Payment::TYPE_COURSES,
            'status' => Payment::STATUS_PAID,
            'paid_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function makeCourse(string $code, ?int $semesterId, array $attributes = []): Course
    {
        return Course::create(array_merge([
            'course_name' => 'Course ' . $code,
            'course_code' => $code,
            'no_of_hours' => 3,
            'cover_image' => 'default.jpg',
            'department_id' => $this->department->id,
            'professor_id' => null,
            'admin_id' => $this->superAdmin->id,
            'semester_id' => $semesterId,
        ], $attributes));
    }

    private function enroll(Course $course, ?int $semesterId): StudentCourse
    {
        return StudentCourse::create([
            'student_id' => $this->student->id,
            'course_id' => $course->id,
            'progress' => 0,
            'status' => StudentCourse::STATUS_REGISTERED,
            'semester_id' => $semesterId,
        ]);
    }

    private function schedule(Course $course, string $day, string $start, string $end, string $type = 'lecture'): Schedule
    {
        return Schedule::create([
            'level_id' => $this->level->id,
            'semester_id' => $this->semester->id,
            'department_id' => $this->department->id,
            'course_id' => $course->id,
            'day_of_week' => $day,
            'start_time' => $start,
            'end_time' => $end,
            'section_type' => $type,
            'admin_id' => $this->superAdmin->id,
        ]);
    }

    public function test_timetable_only_shows_enrolled_courses_in_the_active_semester(): void
    {
        // Legacy course + enrollment with a NULL semester (must be treated as current).
        $legacy = $this->makeCourse('CS203', null);
        $this->enroll($legacy, null);
        $this->schedule($legacy, 'Saturday', '09:00', '10:00');

        // A normal course the student is enrolled in for the active semester.
        $enrolled = $this->makeCourse('CS210', $this->semester->id);
        $this->enroll($enrolled, $this->semester->id);
        $this->schedule($enrolled, 'Sunday', '11:00', '12:00');

        // A course scheduled in the active semester but the student is NOT in.
        $notEnrolled = $this->makeCourse('CS999', $this->semester->id);
        $this->schedule($notEnrolled, 'Monday', '13:00', '14:00', 'section');

        Sanctum::actingAs($this->student);

        $response = $this->getJson('/api/user/schedule')->assertOk();

        $codes = collect($response->json('data.schedule'))->pluck('course_code')->all();

        $this->assertCount(2, $codes);
        $this->assertContains('CS203', $codes);
        $this->assertContains('CS210', $codes);
        $this->assertNotContains('CS999', $codes);
    }

    public function test_timetable_times_are_returned_as_hh_mm(): void
    {
        $course = $this->makeCourse('CS203', $this->semester->id);
        $this->enroll($course, $this->semester->id);
        $this->schedule($course, 'Saturday', '09:00', '10:30');

        Sanctum::actingAs($this->student);

        $this->getJson('/api/user/schedule')
            ->assertOk()
            ->assertJsonPath('data.schedule.0.start_time', '09:00')
            ->assertJsonPath('data.schedule.0.end_time', '10:30');
    }

    public function test_timetable_is_ordered_by_day_of_week_chronologically(): void
    {
        $course = $this->makeCourse('CS203', $this->semester->id);
        $this->enroll($course, $this->semester->id);

        // Monday (index 2) must come before Friday (index 6)... 
        $this->schedule($course, 'Friday', '09:00', '10:00');
        $this->schedule($course, 'Monday', '09:00', '10:00');
        $this->schedule($course, 'Sunday', '09:00', '10:00');

        Sanctum::actingAs($this->student);

        $days = collect($this->getJson('/api/user/schedule')->assertOk()->json('data.schedule'))
            ->pluck('day_of_week')
            ->all();

        // ...and it must be by week order, not the alphabetical order
        // (Friday, Monday, Saturday, Sunday, ...) Eloquent would produce.
        $this->assertSame(['Sunday', 'Monday', 'Friday'], $days);
    }

    public function test_my_courses_and_timetable_agree_on_current_enrollments(): void
    {
        $old = Semester::create(['name' => 'Old', 'academic_year' => '2025-2026', 'is_active' => false]);

        // Current: legacy NULL semester.
        $legacy = $this->makeCourse('CS203', null);
        $this->enroll($legacy, null);
        $this->schedule($legacy, 'Saturday', '09:00', '10:00');

        // Not current: enrollment pointing at an old, inactive semester.
        $oldCourse = $this->makeCourse('OLD101', $old->id);
        $this->enroll($oldCourse, $old->id);
        // A schedule row for it, even in the active semester, must not leak in.
        $this->schedule($oldCourse, 'Tuesday', '09:00', '10:00');

        Sanctum::actingAs($this->student);

        $myCourses = collect($this->getJson('/api/user/courses')->assertOk()->json('data'))
            ->pluck('course_code')
            ->sort()
            ->values()
            ->all();

        $timetable = collect($this->getJson('/api/user/schedule')->assertOk()->json('data.schedule'))
            ->pluck('course_code')
            ->unique()
            ->sort()
            ->values()
            ->all();

        $this->assertSame(['CS203'], $myCourses);
        $this->assertSame($myCourses, $timetable);
    }

    public function test_timetable_is_empty_when_no_semester_is_active(): void
    {
        $this->semester->update(['is_active' => false]);

        $course = $this->makeCourse('CS203', null);
        $this->enroll($course, null);
        $this->schedule($course, 'Saturday', '09:00', '10:00');

        Sanctum::actingAs($this->student);

        $this->getJson('/api/user/schedule')
            ->assertOk()
            ->assertJsonCount(0, 'data.schedule');
    }

    public function test_section_type_is_preserved_in_the_timetable(): void
    {
        $course = $this->makeCourse('CS203', $this->semester->id);
        $this->enroll($course, $this->semester->id);
        $this->schedule($course, 'Saturday', '09:00', '10:00', 'section');

        Sanctum::actingAs($this->student);

        $this->getJson('/api/user/schedule')
            ->assertOk()
            ->assertJsonPath('data.schedule.0.section_type', 'section');
    }
}
