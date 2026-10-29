<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Course;
use App\Models\Department;
use App\Models\Lecture;
use App\Models\Level;
use App\Models\Payment;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Semester;
use App\Models\StudentCourse;
use App\Models\StudentLecture;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers the student data gaps fixed for stage 16: progress must stay inside
 * the current course's lecture set, credit hours must reach My Courses, and the
 * timetable must carry the room and professor the schedule already stores.
 */
class StudentDataGapsTest extends TestCase
{
    use RefreshDatabase;

    private Admin $superAdmin;

    private Department $department;

    private Level $level;

    private Semester $semester;

    private User $student;

    private User $professor;

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
            'level_id' => null,
        ]);

        $this->student->student()->create([
            'department_id' => $this->department->id,
            'level_id' => $this->level->id,
            'semester' => 'first',
            'credit_points' => 0,
        ]);

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

    private function makeCourse(string $code, array $attributes = []): Course
    {
        return Course::create(array_merge([
            'course_name' => 'Course ' . $code,
            'course_code' => $code,
            'no_of_hours' => 3,
            'cover_image' => 'default.jpg',
            'department_id' => $this->department->id,
            'professor_id' => null,
            'admin_id' => $this->superAdmin->id,
            'semester_id' => $this->semester->id,
        ], $attributes));
    }

    private function lecture(Course $course, string $name): Lecture
    {
        return Lecture::create([
            'name' => $name,
            'content' => 'lectures/' . $name . '.pdf',
            'course_id' => $course->id,
        ]);
    }

    private function enroll(Course $course, int $progress = 0): StudentCourse
    {
        return StudentCourse::create([
            'student_id' => $this->student->id,
            'course_id' => $course->id,
            'progress' => $progress,
            'status' => StudentCourse::STATUS_REGISTERED,
            'semester_id' => $this->semester->id,
        ]);
    }

    public function test_my_courses_caps_progress_and_exposes_credit_hours(): void
    {
        $course = $this->makeCourse('CS101');
        $this->lecture($course, 'Intro');
        $this->lecture($course, 'Graphs');
        $this->enroll($course, 99);

        Sanctum::actingAs($this->student);

        $row = $this->getJson('/api/user/courses')
            ->assertOk()
            ->json('data.0');

        $this->assertSame(2, $row['progress']);
        $this->assertSame(2, $row['total_lectures']);
        $this->assertSame(100, $row['progress_percent']);
        $this->assertEquals(3, $row['no_of_hours']);
    }

    public function test_update_progress_ignores_stale_rows_and_counts_only_this_course(): void
    {
        $course = $this->makeCourse('CS101');
        $first = $this->lecture($course, 'Intro');
        $second = $this->lecture($course, 'Graphs');

        $otherCourse = $this->makeCourse('CS102');
        $foreignLecture = $this->lecture($otherCourse, 'Other');

        // A stale row that claims a lecture from another course under this one,
        // plus an inflated stored progress from a legacy/seed row.
        StudentLecture::create([
            'student_id' => $this->student->id,
            'lecture_id' => $foreignLecture->id,
            'course_id' => $course->id,
            'watched_at' => now(),
        ]);

        $enrollment = $this->enroll($course, 99);

        Sanctum::actingAs($this->student);

        $this->putJson('/api/user/update_progress', [
            'course_id' => $course->id,
            'lecture_id' => $first->id,
        ])
            ->assertOk()
            ->assertJsonPath('data.progress', 1)
            ->assertJsonPath('data.total_lectures', 2)
            ->assertJsonPath('data.new_lecture', true);

        $this->assertSame(1, $enrollment->fresh()->progress);

        $this->putJson('/api/user/update_progress', [
            'course_id' => $course->id,
            'lecture_id' => $second->id,
        ])
            ->assertOk()
            ->assertJsonPath('data.progress', 2)
            ->assertJsonPath('data.progress_percent', 100);

        // Re-watching does not double-count.
        $this->putJson('/api/user/update_progress', [
            'course_id' => $course->id,
            'lecture_id' => $second->id,
        ])
            ->assertOk()
            ->assertJsonPath('data.progress', 2)
            ->assertJsonPath('data.new_lecture', false);

        $this->assertSame(2, $enrollment->fresh()->progress);
    }

    public function test_reports_cap_progress_at_the_lecture_total(): void
    {
        $course = $this->makeCourse('CS101');
        $this->lecture($course, 'Intro');
        $this->lecture($course, 'Graphs');
        $this->enroll($course, 65);

        Sanctum::actingAs($this->student);

        $row = $this->getJson('/api/user/reports')
            ->assertOk()
            ->json('data.courses.0');

        $this->assertSame(2, $row['progress']);
        $this->assertSame(2, $row['total_lectures']);
    }

    public function test_timetable_exposes_the_room_and_professor(): void
    {
        $course = $this->makeCourse('CS101', ['professor_id' => $this->professor->id]);
        $this->enroll($course);

        $room = Room::factory()->create([
            'name' => 'Hall 3',
            'building' => 'Building B',
        ]);

        Schedule::create([
            'level_id' => $this->level->id,
            'semester_id' => $this->semester->id,
            'department_id' => $this->department->id,
            'course_id' => $course->id,
            'room_id' => $room->id,
            'day_of_week' => 'Saturday',
            'start_time' => '09:00',
            'end_time' => '10:30',
            'section_type' => 'lecture',
            'admin_id' => $this->superAdmin->id,
        ]);

        Sanctum::actingAs($this->student);

        $this->getJson('/api/user/schedule')
            ->assertOk()
            ->assertJsonPath('data.schedule.0.room', 'Hall 3')
            ->assertJsonPath('data.schedule.0.building', 'Building B')
            ->assertJsonPath('data.schedule.0.professor', $this->professor->name);
    }

    public function test_timetable_room_is_null_when_unassigned(): void
    {
        $course = $this->makeCourse('CS101');
        $this->enroll($course);

        Schedule::create([
            'level_id' => $this->level->id,
            'semester_id' => $this->semester->id,
            'department_id' => $this->department->id,
            'course_id' => $course->id,
            'room_id' => null,
            'day_of_week' => 'Saturday',
            'start_time' => '09:00',
            'end_time' => '10:30',
            'section_type' => 'lecture',
            'admin_id' => $this->superAdmin->id,
        ]);

        Sanctum::actingAs($this->student);

        $this->getJson('/api/user/schedule')
            ->assertOk()
            ->assertJsonPath('data.schedule.0.room', null)
            ->assertJsonPath('data.schedule.0.building', null);
    }
}
