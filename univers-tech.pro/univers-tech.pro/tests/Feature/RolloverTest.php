<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Course;
use App\Models\Department;
use App\Models\Grade;
use App\Models\Level;
use App\Models\Semester;
use App\Models\StudentCourse;
use App\Models\User;
use App\Support\Settings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RolloverTest extends TestCase
{
    use RefreshDatabase;

    private Admin $superAdmin;
    private Department $department;
    private Semester $semester;
    private User $student;
    private User $professor;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = Admin::factory()->create(['id' => 1, 'is_super_admin' => true]);
        $this->department = Department::factory()->create(['admin_id' => $this->superAdmin->id]);

        $l1 = Level::create(['name' => 'Level 1', 'position' => 1]);
        $l2 = Level::create(['name' => 'Level 2', 'position' => 2]);
        $l3 = Level::create(['name' => 'Level 3', 'position' => 3]);
        $l4 = Level::create(['name' => 'Level 4', 'position' => 4]);

        $this->semester = Semester::create([
            'name' => 'Fall',
            'academic_year' => '2026',
            'is_active' => true,
        ]);

        $this->professor = $this->makeProfessor();
        $this->student = $this->makeStudent($l1->id);
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

    private function makeStudent(int $levelId, string $term = 'first'): User
    {
        $user = User::factory()->create([
            'type' => User::TYPE_STUDENT,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => $levelId,
            'semester' => $term,
        ]);

        $user->student()->create([
            'department_id' => $this->department->id,
            'level_id' => $levelId,
            'semester' => $term,
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

    public function test_close_semester_locks_published_grades(): void
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
        $this->postJson('/api/rollover/semester/close', ['semester_id' => $this->semester->id])->assertOk();

        $this->assertDatabaseHas('grades', [
            'id' => $grade->id,
            'status' => Grade::STATUS_LOCKED,
        ]);
        $this->assertDatabaseHas('semesters', [
            'id' => $this->semester->id,
            'is_active' => false,
        ]);
    }

    public function test_close_semester_resolves_enrollments(): void
    {
        $coursePass = $this->makeCourse();
        $courseFail = $this->makeCourse();
        $courseNoGrade = $this->makeCourse();

        Grade::create([
            'student_id' => $this->student->id,
            'course_id' => $coursePass->id,
            'semester_id' => $this->semester->id,
            'marks' => 70,
            'max_marks' => 100,
            'status' => Grade::STATUS_PUBLISHED,
            'published_at' => now(),
        ]);

        Grade::create([
            'student_id' => $this->student->id,
            'course_id' => $courseFail->id,
            'semester_id' => $this->semester->id,
            'marks' => 30,
            'max_marks' => 100,
            'status' => Grade::STATUS_PUBLISHED,
            'published_at' => now(),
        ]);

        Sanctum::actingAs($this->superAdmin);
        $res = $this->postJson('/api/rollover/semester/close', ['semester_id' => $this->semester->id])->assertOk();
        $data = $res->json('data');

        $this->assertDatabaseHas('student_courses', [
            'student_id' => $this->student->id,
            'course_id' => $coursePass->id,
            'status' => StudentCourse::STATUS_COMPLETED,
        ]);
        $this->assertDatabaseHas('student_courses', [
            'student_id' => $this->student->id,
            'course_id' => $courseFail->id,
            'status' => StudentCourse::STATUS_FAILED,
        ]);
        $this->assertDatabaseHas('student_courses', [
            'student_id' => $this->student->id,
            'course_id' => $courseNoGrade->id,
            'status' => StudentCourse::STATUS_REGISTERED,
        ]);
    }

    public function test_preview_promotion_changes_nothing(): void
    {
        $student = $this->student;
        $oldLevel = $student->level_id;
        $oldSem = $student->semester;

        Sanctum::actingAs($this->superAdmin);
        $this->getJson('/api/rollover/promotion/preview?from_semester_id=' . $this->semester->id)->assertOk();

        $this->assertDatabaseHas('users', [
            'id' => $student->id,
            'level_id' => $oldLevel,
            'semester' => $oldSem,
        ]);
    }

    public function test_apply_promotion_is_idempotent(): void
    {
        $student = $this->student;
        $oldLevel = $student->level_id;
        $oldSem = $student->semester;

        Sanctum::actingAs($this->superAdmin);
        $this->postJson('/api/rollover/promotion/apply?from_semester_id=' . $this->semester->id)->assertOk();

        $this->assertDatabaseHas('users', [
            'id' => $student->id,
            'level_id' => $oldLevel,
            'semester' => 'second',
        ]);

        $count = \App\Models\StudentPromotion::count();
        $this->postJson('/api/rollover/promotion/apply?from_semester_id=' . $this->semester->id)->assertOk();
        $this->assertSame($count, \App\Models\StudentPromotion::count());
    }

    public function test_graduation_at_final_level(): void
    {
        $final = Level::where('position', 4)->first();
        $student = $this->makeStudent($final->id, 'second');

        Sanctum::actingAs($this->superAdmin);
        $this->postJson('/api/rollover/promotion/apply?from_semester_id=' . $this->semester->id)->assertOk();

        $this->assertDatabaseHas('users', [
            'id' => $student->id,
            'status' => User::STATUS_GRADUATED,
        ]);
    }

    public function test_exclusions_prevent_promotion(): void
    {
        $student = $this->student;
        $oldSem = $student->semester;
        $oldLevel = $student->level_id;

        Sanctum::actingAs($this->superAdmin);
        $this->postJson('/api/rollover/promotion/apply?from_semester_id=' . $this->semester->id . '&exclude[]=' . $student->id)->assertOk();

        $this->assertDatabaseHas('users', [
            'id' => $student->id,
            'level_id' => $oldLevel,
            'semester' => $oldSem,
        ]);
    }

    public function test_scope_enforcement(): void
    {
        $admin = Admin::factory()->create(['is_super_admin' => false, 'roles' => []]);
        Sanctum::actingAs($admin);

        $this->getJson('/api/rollover/close/preview?semester_id=' . $this->semester->id)->assertStatus(403);
    }
}
