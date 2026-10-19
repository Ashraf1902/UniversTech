<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Course;
use App\Models\Department;
use App\Models\Payment;
use App\Models\Semester;
use App\Models\StudentCourse;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PurgeTestStudentsCommandTest extends TestCase
{
    use RefreshDatabase;

    private Admin $superAdmin;

    private Department $department;

    private Semester $semester;

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
    }

    private function makeStudent(string $email): User
    {
        return User::factory()->create([
            'email' => $email,
            'type' => User::TYPE_STUDENT,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->superAdmin->id,
            'department_id' => $this->department->id,
            'level_id' => null,
        ]);
    }

    private function enroll(User $student): StudentCourse
    {
        $course = Course::create([
            'course_name' => 'Course',
            'course_code' => 'P' . $student->id,
            'no_of_hours' => 3,
            'cover_image' => 'default.jpg',
            'department_id' => $this->department->id,
            'professor_id' => null,
            'admin_id' => $this->superAdmin->id,
            'semester_id' => $this->semester->id,
        ]);

        return StudentCourse::create([
            'student_id' => $student->id,
            'course_id' => $course->id,
            'progress' => 0,
            'status' => StudentCourse::STATUS_REGISTERED,
            'semester_id' => $this->semester->id,
        ]);
    }

    public function test_dry_run_reports_matches_but_deletes_nothing(): void
    {
        $target = $this->makeStudent('student@test.com');
        $enrollment = $this->enroll($target);

        $this->artisan('data:purge-test-students')
            ->expectsOutputToContain('student@test.com')
            ->expectsOutputToContain('[dry-run] No rows changed')
            ->assertExitCode(0);

        $this->assertDatabaseHas('users', ['id' => $target->id, 'deleted_at' => null]);
        $this->assertDatabaseHas('student_courses', ['id' => $enrollment->id]);
    }

    public function test_apply_removes_the_accounts_and_their_enrollments(): void
    {
        $target = $this->makeStudent('student@test.com');
        $enrollment = $this->enroll($target);

        Payment::forceCreate([
            'user_id' => $target->id,
            'semester_id' => $this->semester->id,
            'amount' => Payment::PRICE_COURSES,
            'type' => Payment::TYPE_COURSES,
            'status' => Payment::STATUS_PAID,
        ]);

        $this->artisan('data:purge-test-students', ['--apply' => true])->assertExitCode(0);

        // Force delete (not soft delete) so the FK cascades run.
        $this->assertDatabaseMissing('users', ['id' => $target->id]);
        $this->assertDatabaseMissing('student_courses', ['id' => $enrollment->id]);
        $this->assertDatabaseMissing('payments', ['user_id' => $target->id]);
    }

    public function test_it_only_touches_the_known_test_accounts(): void
    {
        $keep = $this->makeStudent('student@universtech.demo');
        $keepEnrollment = $this->enroll($keep);

        $remove = $this->makeStudent('student5@universtech.edu');
        $this->enroll($remove);

        $this->artisan('data:purge-test-students', ['--apply' => true])->assertExitCode(0);

        $this->assertDatabaseHas('users', ['id' => $keep->id, 'deleted_at' => null]);
        $this->assertDatabaseHas('student_courses', ['id' => $keepEnrollment->id]);
        $this->assertDatabaseMissing('users', ['id' => $remove->id]);
    }

    public function test_it_reports_when_nothing_matches(): void
    {
        $this->artisan('data:purge-test-students')
            ->expectsOutputToContain('No matching accounts found')
            ->assertExitCode(0);
    }
}
