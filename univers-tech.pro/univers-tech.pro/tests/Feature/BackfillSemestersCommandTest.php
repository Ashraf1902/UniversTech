<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Course;
use App\Models\Department;
use App\Models\Semester;
use App\Models\StudentCourse;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BackfillSemestersCommandTest extends TestCase
{
    use RefreshDatabase;

    private Admin $superAdmin;

    private Department $department;

    private Semester $semester;

    private User $student;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = Admin::factory()->create(['id' => 1, 'is_super_admin' => true]);
        $this->department = Department::factory()->create(['admin_id' => $this->superAdmin->id]);

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
    }

    private function makeCourse(?int $semesterId): Course
    {
        static $n = 0;
        $n++;

        return Course::create([
            'course_name' => 'Course ' . $n,
            'course_code' => 'C' . $n,
            'no_of_hours' => 3,
            'cover_image' => 'default.jpg',
            'department_id' => $this->department->id,
            'professor_id' => null,
            'admin_id' => $this->superAdmin->id,
            'semester_id' => $semesterId,
        ]);
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

    public function test_dry_run_reports_but_changes_nothing(): void
    {
        $course = $this->makeCourse(null);
        $this->enroll($course, null);

        $this->artisan('data:backfill-semesters', ['--dry-run' => true])
            ->expectsOutputToContain('Would assign 1 course(s) and 1 enrollment(s)')
            ->assertExitCode(0);

        $this->assertNull($course->fresh()->semester_id);
        $this->assertNull(StudentCourse::first()->semester_id);
    }

    public function test_command_assigns_the_active_semester_to_null_rows_only(): void
    {
        $old = Semester::create(['name' => 'Old', 'academic_year' => '2025-2026', 'is_active' => false]);

        $nullCourse = $this->makeCourse(null);
        $this->enroll($nullCourse, null);

        // Rows that already have a (different) semester must be left untouched.
        $oldCourse = $this->makeCourse($old->id);
        $this->enroll($oldCourse, $old->id);

        $this->artisan('data:backfill-semesters')->assertExitCode(0);

        $this->assertSame($this->semester->id, $nullCourse->fresh()->semester_id);
        $this->assertSame($old->id, $oldCourse->fresh()->semester_id);

        $this->assertDatabaseMissing('courses', ['id' => $nullCourse->id, 'semester_id' => null]);
        $this->assertDatabaseMissing('student_courses', ['course_id' => $nullCourse->id, 'semester_id' => null]);

        // Old-semester rows are unchanged.
        $this->assertDatabaseHas('courses', ['id' => $oldCourse->id, 'semester_id' => $old->id]);
    }

    public function test_command_accepts_an_explicit_semester_and_is_idempotent(): void
    {
        $target = Semester::create(['name' => 'Target', 'academic_year' => '2027-2028', 'is_active' => false]);

        $course = $this->makeCourse(null);
        $this->enroll($course, null);

        $this->artisan('data:backfill-semesters', ['--semester' => $target->id])->assertExitCode(0);
        $this->assertSame($target->id, $course->fresh()->semester_id);

        // Running again changes nothing and still succeeds.
        $this->artisan('data:backfill-semesters', ['--semester' => $target->id])
            ->expectsOutputToContain('courses with NULL semester: 0')
            ->assertExitCode(0);
    }

    public function test_command_fails_when_there_is_no_target_semester(): void
    {
        Semester::query()->delete();

        $this->makeCourse(null);

        $this->artisan('data:backfill-semesters')->assertExitCode(1);
    }
}
