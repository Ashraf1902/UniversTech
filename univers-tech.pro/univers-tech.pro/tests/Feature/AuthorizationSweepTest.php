<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Announcement;
use App\Models\Course;
use App\Models\Department;
use App\Models\Level;
use App\Models\Payment;
use App\Models\Quiz;
use App\Models\Semester;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Role x endpoint authorization sweep for the endpoints delivered in stages
 * 4–12 (payments, attendance, grades, quizzes, announcements, imports,
 * reports, activity, admin management). Verifies the role middleware, the
 * admin scope middleware and the professor course-ownership policy together.
 */
class AuthorizationSweepTest extends TestCase
{
    use RefreshDatabase;

    private Admin $superAdmin;

    private Semester $semester;

    private User $professorA;

    private User $professorB;

    private Course $courseA;

    private Course $courseB;

    private User $student;

    private User $otherStudent;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = Admin::factory()->create(['id' => 1, 'is_super_admin' => true]);
        $this->semester = Semester::create(['name' => 'First', 'academic_year' => '2026/2027', 'is_active' => true]);
        $department = Department::factory()->create(['admin_id' => $this->superAdmin->id]);
        Level::factory()->create();

        $this->professorA = User::factory()->create([
            'type' => User::TYPE_PROFESSOR,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ]);

        $this->professorB = User::factory()->create([
            'type' => User::TYPE_PROFESSOR,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ]);

        $this->student = $this->makeStudent();
        $this->otherStudent = $this->makeStudent();

        $this->courseA = Course::create([
            'course_name' => 'Alpha',
            'course_code' => 'AAA101',
            'no_of_hours' => 3,
            'department_id' => $department->id,
            'professor_id' => $this->professorA->id,
            'admin_id' => $this->superAdmin->id,
            'semester_id' => $this->semester->id,
        ]);

        $this->courseB = Course::create([
            'course_name' => 'Beta',
            'course_code' => 'BBB101',
            'no_of_hours' => 3,
            'department_id' => $department->id,
            'professor_id' => $this->professorB->id,
            'admin_id' => $this->superAdmin->id,
            'semester_id' => $this->semester->id,
        ]);
    }

    private function makeStudent(): User
    {
        return User::factory()->create([
            'type' => User::TYPE_STUDENT,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ]);
    }

    private function scopedAdmin(array $roles): Admin
    {
        return Admin::factory()->create([
            'is_super_admin' => false,
            'roles' => $roles,
        ]);
    }

    public function test_student_is_blocked_from_admin_and_professor_endpoints(): void
    {
        Sanctum::actingAs($this->student);

        $forbidden = [
            ['get', '/api/activity/get/all'],
            ['get', '/api/report/enrollment'],
            ['get', '/api/payment/get/all'],
            ['get', '/api/settings/get/all'],
            ['get', '/api/import/students/template'],
            ['post', '/api/import/students/preview'],
            ['get', '/api/professors/courses'],
            ['get', '/api/professor/profile'],
        ];

        foreach ($forbidden as [$method, $uri]) {
            $this->{$method.'Json'}($uri)->assertStatus(403);
        }
    }

    public function test_professor_is_blocked_from_admin_and_student_endpoints(): void
    {
        Sanctum::actingAs($this->professorA);

        $forbidden = [
            ['get', '/api/activity/get/all'],
            ['get', '/api/course/get/all'],
            ['get', '/api/user'],
            ['get', '/api/user/payments'],
            ['get', '/api/user/notifications'],
        ];

        foreach ($forbidden as [$method, $uri]) {
            $this->{$method.'Json'}($uri)->assertStatus(403);
        }
    }

    public function test_scoped_admin_is_limited_to_assigned_scopes(): void
    {
        Sanctum::actingAs($this->scopedAdmin(['payments', 'reports']));

        $this->getJson('/api/report/enrollment')->assertStatus(200);
        $this->getJson('/api/payment/get/all')->assertStatus(200);

        $forbidden = [
            '/api/course/get/all',
            '/api/activity/get/all',
            '/api/settings/get/all',
            '/api/import/students/template',
            '/api/import/courses/template',
            '/api/attendance/get/all',
            '/api/access-request/get/all',
        ];

        foreach ($forbidden as $uri) {
            $this->getJson($uri)->assertStatus(403);
        }
    }

    public function test_accounts_admin_can_import_students_but_not_courses(): void
    {
        Sanctum::actingAs($this->scopedAdmin(['accounts']));

        $this->getJson('/api/import/students/template')->assertStatus(200);
        $this->getJson('/api/import/courses/template')->assertStatus(403);
    }

    public function test_super_admin_can_reach_every_scope_group(): void
    {
        Sanctum::actingAs($this->superAdmin);

        $allowed = [
            '/api/activity/get/all',
            '/api/report/enrollment',
            '/api/payment/get/all',
            '/api/course/get/all',
            '/api/settings/get/all',
            '/api/attendance/get/all',
            '/api/access-request/get/all',
            '/api/import/students/template',
            '/api/import/courses/template',
            '/api/admin-management/get/all',
        ];

        foreach ($allowed as $uri) {
            $this->getJson($uri)->assertStatus(200);
        }
    }

    public function test_admin_management_is_super_admin_only(): void
    {
        Sanctum::actingAs($this->scopedAdmin(['accounts']));
        $this->getJson('/api/admin-management/get/all')->assertStatus(403);
    }

    public function test_suspended_student_is_blocked_even_with_a_valid_session(): void
    {
        $this->student->update(['status' => User::STATUS_SUSPENDED]);

        Sanctum::actingAs($this->student);

        $this->getJson('/api/user')->assertStatus(403);
        $this->getJson('/api/user/notifications')->assertStatus(403);
    }

    public function test_suspended_professor_is_blocked_even_with_a_valid_session(): void
    {
        $this->professorA->update(['status' => User::STATUS_SUSPENDED]);

        Sanctum::actingAs($this->professorA);

        $this->getJson('/api/professors/courses')->assertStatus(403);
    }

    public function test_professor_cannot_touch_another_professors_course(): void
    {
        $quiz = Quiz::create([
            'name' => 'Quiz A',
            'content' => 'quizzes/aaa101-quiz.pdf',
            'course_id' => $this->courseA->id,
            'max_score' => 20,
            'published_at' => now(),
        ]);

        $announcement = \App\Models\Announcement::create([
            'course_id' => $this->courseA->id,
            'professor_id' => $this->professorA->id,
            'title' => 'Announcement A',
            'body' => 'Body A',
        ]);

        Sanctum::actingAs($this->professorB);

        $this->getJson('/api/quiz/get/all/' . $this->courseA->id)->assertStatus(403);
        $this->deleteJson('/api/quiz/delete/' . $quiz->id)->assertStatus(403);
        $this->deleteJson('/api/professor/announcement/delete/' . $announcement->id)->assertStatus(403);

        Sanctum::actingAs($this->professorA);

        $this->getJson('/api/quiz/get/all/' . $this->courseA->id)->assertStatus(200);
    }

    public function test_student_cannot_read_another_students_receipt(): void
    {
        $payment = Payment::create([
            'user_id' => $this->otherStudent->id,
            'semester_id' => $this->semester->id,
            'amount' => 700,
            'type' => Payment::TYPE_COURSES,
            'status' => Payment::STATUS_PAID,
            'paid_at' => now(),
        ]);

        Sanctum::actingAs($this->student);

        $this->getJson('/api/user/payment/' . $payment->id . '/receipt')->assertStatus(404);
        $this->getJson('/api/user/payments')->assertStatus(200);
    }

    public function test_unpaid_student_cannot_open_paid_course_content(): void
    {
        Sanctum::actingAs($this->student);

        $this->getJson('/api/user/courses')->assertStatus(403);

        Payment::create([
            'user_id' => $this->student->id,
            'semester_id' => $this->semester->id,
            'amount' => 700,
            'type' => Payment::TYPE_COURSES,
            'status' => Payment::STATUS_PAID,
            'paid_at' => now(),
        ]);

        $this->getJson('/api/user/courses')->assertStatus(200);
    }
}
