<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Announcement;
use App\Models\Course;
use App\Models\Department;
use App\Models\Level;
use App\Models\Notification;
use App\Models\Payment;
use App\Models\Semester;
use App\Models\StudentCourse;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AnnouncementTest extends TestCase
{
    use RefreshDatabase;

    private Admin $superAdmin;

    private Department $department;

    private Level $level;

    private User $professorA;

    private User $professorB;

    private Course $courseA;

    private Course $courseB;

    private User $registeredStudent;

    private User $anotherRegisteredStudent;

    private User $droppedStudent;

    private User $outOfCourseStudent;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = Admin::factory()->create(['id' => 1, 'is_super_admin' => true]);
        $this->department = Department::factory()->create(['admin_id' => $this->superAdmin->id]);
        $this->level = Level::factory()->create();

        $semester = Semester::create([
            'name' => 'Fall',
            'academic_year' => '2026',
            'is_active' => true,
        ]);

        $this->professorA = $this->makeProfessor();
        $this->professorB = $this->makeProfessor();

        $this->courseA = $this->makeCourse('Algorithms', 'CS101', $this->professorA, $semester);
        $this->courseB = $this->makeCourse('Databases', 'CS202', $this->professorB, $semester);

        $this->registeredStudent = $this->makeStudent();
        $this->anotherRegisteredStudent = $this->makeStudent();
        $this->droppedStudent = $this->makeStudent();
        $this->outOfCourseStudent = $this->makeStudent();

        $this->enroll($this->registeredStudent, $this->courseA, StudentCourse::STATUS_REGISTERED);
        $this->enroll($this->anotherRegisteredStudent, $this->courseA, StudentCourse::STATUS_REGISTERED);
        $this->enroll($this->droppedStudent, $this->courseA, StudentCourse::STATUS_DROPPED);
        $this->enroll($this->outOfCourseStudent, $this->courseB, StudentCourse::STATUS_REGISTERED);
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

    private function makeStudent(): User
    {
        $student = User::factory()->create([
            'type' => User::TYPE_STUDENT,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ]);

        $student->student()->create([
            'department_id' => $this->department->id,
            'level_id' => $this->level->id,
            'semester' => 'first',
            'credit_points' => 0,
        ]);

        return $student;
    }

    private function makeCourse(string $name, string $code, User $professor, Semester $semester): Course
    {
        return Course::create([
            'course_name' => $name,
            'course_code' => $code,
            'no_of_hours' => 3,
            'cover_image' => 'default.jpg',
            'department_id' => $this->department->id,
            'professor_id' => $professor->id,
            'admin_id' => $this->superAdmin->id,
            'semester_id' => $semester->id,
        ]);
    }

    private function enroll(User $student, Course $course, string $status): void
    {
        StudentCourse::create([
            'student_id' => $student->id,
            'course_id' => $course->id,
            'status' => $status,
        ]);
    }

    public function test_professor_posts_announcement_and_only_registered_students_are_notified(): void
    {
        Sanctum::actingAs($this->professorA);

        $response = $this->postJson('/api/professor/announcement/store', [
            'course_id' => $this->courseA->id,
            'title' => 'Midterm covers chapters 1-5',
            'body' => 'Bring your student ID.',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.course_id', $this->courseA->id)
            ->assertJsonPath('data.title', 'Midterm covers chapters 1-5');

        $this->assertDatabaseHas('announcements', [
            'course_id' => $this->courseA->id,
            'professor_id' => $this->professorA->id,
            'title' => 'Midterm covers chapters 1-5',
        ]);

        $notificationIds = collect(
            Notification::where('category', Notification::CATEGORY_ANNOUNCEMENT)
                ->pluck('student_id')
                ->map(fn ($id) => (int) $id)
                ->all()
        )->sort()->values()->all();

        $this->assertSame(
            [$this->registeredStudent->id, $this->anotherRegisteredStudent->id],
            $notificationIds
        );

        $this->assertDatabaseMissing('notifications', ['student_id' => $this->droppedStudent->id]);
        $this->assertDatabaseMissing('notifications', ['student_id' => $this->outOfCourseStudent->id]);
        $this->assertDatabaseHas('notifications', [
            'course_id' => $this->courseA->id,
            'announcement_id' => Announcement::first()->id,
            'professor_id' => $this->professorA->id,
            'type' => Notification::TYPE_NOTIFICATION,
        ]);
    }

    public function test_a_professor_cannot_announce_for_another_professors_course(): void
    {
        Sanctum::actingAs($this->professorB);

        $this->postJson('/api/professor/announcement/store', [
            'course_id' => $this->courseA->id,
            'title' => 'Not mine',
            'body' => 'Should be rejected.',
        ])->assertStatus(403);

        $this->assertDatabaseCount('announcements', 0);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_a_student_cannot_post_an_announcement(): void
    {
        Sanctum::actingAs($this->registeredStudent);

        $this->postJson('/api/professor/announcement/store', [
            'course_id' => $this->courseA->id,
            'title' => 'Student post',
            'body' => 'Should be rejected.',
        ])->assertStatus(403);

        $this->assertDatabaseCount('announcements', 0);
    }

    public function test_announcements_appear_on_the_course_page_and_the_students_feed(): void
    {
        Sanctum::actingAs($this->professorA);
        $announcementId = $this->postJson('/api/professor/announcement/store', [
            'course_id' => $this->courseA->id,
            'title' => 'Room change',
            'body' => 'Today we meet in B204.',
        ])->assertStatus(201)->json('data.id');

        Payment::create([
            'user_id' => $this->registeredStudent->id,
            'amount' => Payment::PRICE_COURSES,
            'type' => Payment::TYPE_COURSES,
            'status' => Payment::STATUS_PAID,
            'paid_at' => now(),
        ]);

        Sanctum::actingAs($this->registeredStudent);

        $this->getJson('/api/user/course/' . $this->courseA->id)
            ->assertStatus(200)
            ->assertJsonPath('data.announcements.0.title', 'Room change')
            ->assertJsonPath('data.announcements.0.body', 'Today we meet in B204.');

        $this->getJson('/api/user/notifications/announcments')
            ->assertStatus(200)
            ->assertJsonFragment(['id' => $announcementId]);

        $this->getJson('/api/user/notifications')
            ->assertStatus(200)
            ->assertJsonFragment(['id' => $announcementId]);
    }

    public function test_professor_can_update_and_delete_only_their_own_announcements(): void
    {
        Sanctum::actingAs($this->professorA);
        $announcement = Announcement::create([
            'course_id' => $this->courseA->id,
            'professor_id' => $this->professorA->id,
            'title' => 'Draft',
            'body' => 'Draft body',
        ]);

        Sanctum::actingAs($this->professorB);
        $this->postJson('/api/professor/announcement/update', [
            'announcement_id' => $announcement->id,
            'title' => 'Hijacked',
        ])->assertStatus(403);
        $this->deleteJson('/api/professor/announcement/delete/' . $announcement->id)
            ->assertStatus(403);

        Sanctum::actingAs($this->professorA);
        $this->postJson('/api/professor/announcement/update', [
            'announcement_id' => $announcement->id,
            'title' => 'Final title',
        ])->assertStatus(200);
        $this->assertDatabaseHas('announcements', ['id' => $announcement->id, 'title' => 'Final title']);

        $this->deleteJson('/api/professor/announcement/delete/' . $announcement->id)
            ->assertStatus(200);
        $this->assertDatabaseMissing('announcements', ['id' => $announcement->id]);
    }

    public function test_professor_announcement_list_only_returns_own_rows(): void
    {
        Announcement::create([
            'course_id' => $this->courseA->id,
            'professor_id' => $this->professorA->id,
            'title' => 'A post',
            'body' => 'Body A',
        ]);
        Announcement::create([
            'course_id' => $this->courseB->id,
            'professor_id' => $this->professorB->id,
            'title' => 'B post',
            'body' => 'Body B',
        ]);

        Sanctum::actingAs($this->professorA);

        $this->getJson('/api/professor/announcement/get/all')
            ->assertStatus(200)
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.title', 'A post');
    }

    public function test_admin_can_moderate_any_announcement_and_the_orphaned_feed_rows_follow_it(): void
    {
        $announcement = Announcement::create([
            'course_id' => $this->courseA->id,
            'professor_id' => $this->professorA->id,
            'title' => 'Off topic',
            'body' => 'Reported.',
        ]);
        Notification::create([
            'student_id' => $this->registeredStudent->id,
            'announcement_id' => $announcement->id,
            'category' => Notification::CATEGORY_ANNOUNCEMENT,
            'course_id' => $this->courseA->id,
            'title' => 'Off topic',
            'content' => 'Reported.',
            'type' => Notification::TYPE_NOTIFICATION,
        ]);

        Sanctum::actingAs($this->makeScopedAdmin(['courses']));

        $this->getJson('/api/announcement/get/all')
            ->assertStatus(200)
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.title', 'Off topic');

        $this->deleteJson('/api/announcement/delete/' . $announcement->id)
            ->assertStatus(200);

        $this->assertDatabaseMissing('announcements', ['id' => $announcement->id]);
        $this->assertDatabaseMissing('notifications', ['announcement_id' => $announcement->id]);
    }

    public function test_admin_without_the_courses_scope_cannot_moderate_announcements(): void
    {
        $announcement = Announcement::create([
            'course_id' => $this->courseA->id,
            'professor_id' => $this->professorA->id,
            'title' => 'Protected',
            'body' => 'Body',
        ]);

        Sanctum::actingAs($this->makeScopedAdmin(['events']));

        $this->getJson('/api/announcement/get/all')->assertStatus(403);
        $this->deleteJson('/api/announcement/delete/' . $announcement->id)->assertStatus(403);

        $this->assertDatabaseHas('announcements', ['id' => $announcement->id]);
    }

    private function makeScopedAdmin(array $roles): Admin
    {
        return Admin::factory()->create(['is_super_admin' => false, 'roles' => $roles]);
    }
}
