<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Course;
use App\Models\Department;
use App\Models\Grade;
use App\Models\Lecture;
use App\Models\Level;
use App\Models\Payment;
use App\Models\Quiz;
use App\Models\StudentCourse;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProfessorCourseOwnershipTest extends TestCase
{
    use RefreshDatabase;

    private User $professorA;

    private User $professorB;

    private Course $courseA;

    private User $student;

    private Lecture $lectureA;

    private Quiz $quizA;

    private Grade $gradeA;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('files');

        $admin = Admin::factory()->create(['id' => 1, 'is_super_admin' => true]);
        $department = Department::factory()->create(['id' => 1, 'admin_id' => $admin->id]);
        $level = Level::factory()->create(['id' => 1]);

        $this->professorA = User::factory()->create([
            'type' => User::TYPE_PROFESSOR,
            'admin_id' => $admin->id,
            'department_id' => null,
            'level_id' => null,
        ]);
        $this->professorB = User::factory()->create([
            'type' => User::TYPE_PROFESSOR,
            'admin_id' => $admin->id,
            'department_id' => null,
            'level_id' => null,
        ]);

        $this->courseA = Course::create([
            'course_name' => 'Algorithms',
            'course_code' => 'CS101',
            'no_of_hours' => 3,
            'department_id' => $department->id,
            'professor_id' => $this->professorA->id,
            'admin_id' => $admin->id,
        ]);

        $this->student = User::factory()->create([
            'type' => User::TYPE_STUDENT,
            'admin_id' => $admin->id,
            'department_id' => null,
            'level_id' => null,
        ]);
        $this->student->student()->create([
            'department_id' => $department->id,
            'level_id' => $level->id,
            'semester' => 'first',
            'credit_points' => 0,
        ]);

        StudentCourse::create([
            'student_id' => $this->student->id,
            'course_id' => $this->courseA->id,
        ]);

        $this->lectureA = Lecture::create([
            'name' => 'Intro',
            'content' => 'lectures/intro.pdf',
            'course_id' => $this->courseA->id,
        ]);

        $this->quizA = Quiz::create([
            'name' => 'Quiz 1',
            'content' => 'quizzes/quiz1.pdf',
            'course_id' => $this->courseA->id,
        ]);

        $this->gradeA = Grade::create([
            'student_id' => $this->student->id,
            'course_id' => $this->courseA->id,
            'marks' => 80,
            'max_marks' => 100,
            'status' => Grade::STATUS_DRAFT,
        ]);
    }

    public function test_professor_can_list_students_of_own_course_but_not_others(): void
    {
        Sanctum::actingAs($this->professorA);
        $this->getJson('/api/professors/course/student?course_id=' . $this->courseA->id)->assertOk();

        Sanctum::actingAs($this->professorB);
        $this->getJson('/api/professors/course/student?course_id=' . $this->courseA->id)->assertStatus(403);
    }

    public function test_professor_can_record_attendance_only_for_own_course(): void
    {
        $payload = [
            'date' => now()->toDateString(),
            'status' => false,
            'student_id' => $this->student->id,
            'lecture_id' => $this->lectureA->id,
        ];

        Sanctum::actingAs($this->professorB);
        $this->postJson('/api/professors/make/attendance', $payload)->assertStatus(403);

        Sanctum::actingAs($this->professorA);
        $this->postJson('/api/professors/make/attendance', $payload)->assertStatus(201);
    }

    public function test_professor_can_list_and_upload_lectures_only_for_own_course(): void
    {
        Sanctum::actingAs($this->professorB);
        $this->getJson('/api/lecture/get/all/' . $this->courseA->id)->assertStatus(403);
        $this->post('/api/lecture/store', [
            'name' => 'Lecture B',
            'course_id' => $this->courseA->id,
            'pdf' => UploadedFile::fake()->create('b.pdf', 10, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertStatus(403);

        Sanctum::actingAs($this->professorA);
        $this->getJson('/api/lecture/get/all/' . $this->courseA->id)->assertOk();
        $this->post('/api/lecture/store', [
            'name' => 'Lecture A',
            'course_id' => $this->courseA->id,
            'pdf' => UploadedFile::fake()->create('a.pdf', 10, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertStatus(201);
    }

    public function test_professor_can_list_upload_and_delete_quizzes_only_for_own_course(): void
    {
        Sanctum::actingAs($this->professorB);
        $this->getJson('/api/quiz/get/all/' . $this->courseA->id)->assertStatus(403);
        $this->deleteJson('/api/quiz/delete/' . $this->quizA->id)->assertStatus(403);
        $this->post('/api/quiz/store', [
            'name' => 'Quiz B',
            'course_id' => $this->courseA->id,
            'pdf' => UploadedFile::fake()->create('qb.pdf', 10, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertStatus(403);

        Sanctum::actingAs($this->professorA);
        $this->getJson('/api/quiz/get/all/' . $this->courseA->id)->assertOk();
        $this->post('/api/quiz/store', [
            'name' => 'Quiz A',
            'course_id' => $this->courseA->id,
            'pdf' => UploadedFile::fake()->create('qa.pdf', 10, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertStatus(201);
        $this->deleteJson('/api/quiz/delete/' . $this->quizA->id)->assertOk();
    }

    public function test_professor_can_store_list_and_delete_grades_only_for_own_course(): void
    {
        $payload = [
            'student_id' => $this->student->id,
            'course_id' => $this->courseA->id,
            'marks' => 90,
            'max_marks' => 100,
        ];

        Sanctum::actingAs($this->professorB);
        $this->postJson('/api/professor/grade/store', $payload)->assertStatus(403);
        $this->getJson('/api/professor/grade/get/all?course_id=' . $this->courseA->id)->assertStatus(403);
        $this->deleteJson('/api/professor/grade/delete/' . $this->gradeA->id)->assertStatus(403);

        Sanctum::actingAs($this->professorA);
        $this->postJson('/api/professor/grade/store', $payload)->assertOk();
        $this->getJson('/api/professor/grade/get/all?course_id=' . $this->courseA->id)->assertOk();
        $this->deleteJson('/api/professor/grade/delete/' . $this->gradeA->id)->assertOk();
    }

    public function test_student_cannot_act_on_courses_they_are_not_enrolled_in(): void
    {
        $otherCourse = Course::create([
            'course_name' => 'Databases',
            'course_code' => 'CS202',
            'no_of_hours' => 3,
            'department_id' => null,
            'professor_id' => $this->professorA->id,
            'admin_id' => 1,
        ]);

        Payment::create([
            'user_id' => $this->student->id,
            'amount' => Payment::PRICE_COURSES,
            'type' => Payment::TYPE_COURSES,
            'status' => Payment::STATUS_PAID,
        ]);

        Sanctum::actingAs($this->student);
        $this->getJson('/api/user/course/' . $otherCourse->id)->assertStatus(404);
        $this->getJson('/api/user/course/' . $this->courseA->id)->assertOk();
    }
}
