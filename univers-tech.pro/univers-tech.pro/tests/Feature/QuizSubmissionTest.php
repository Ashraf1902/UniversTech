<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Course;
use App\Models\Department;
use App\Models\Level;
use App\Models\Notification;
use App\Models\Payment;
use App\Models\Quiz;
use App\Models\QuizSubmission;
use App\Models\StudentCourse;
use App\Models\User;
use App\Support\Settings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class QuizSubmissionTest extends TestCase
{
    use RefreshDatabase;

    private User $professorA;

    private User $professorB;

    private Course $courseA;

    private Course $courseB;

    private User $student;

    private Quiz $quizA;

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

        $this->courseB = Course::create([
            'course_name' => 'Databases',
            'course_code' => 'CS202',
            'no_of_hours' => 3,
            'department_id' => $department->id,
            'professor_id' => $this->professorB->id,
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

        Payment::forceCreate([
            'user_id' => $this->student->id,
            'amount' => Payment::PRICE_COURSES,
            'type' => Payment::TYPE_COURSES,
            'status' => Payment::STATUS_PAID,
        ]);

        $this->quizA = Quiz::create([
            'name' => 'Quiz 1',
            'content' => 'quizzes/quiz1.pdf',
            'course_id' => $this->courseA->id,
            'max_score' => 20,
            'due_at' => now()->addDay(),
            'published_at' => now(),
        ]);
    }

    public function test_student_can_list_and_view_published_quizzes_of_registered_courses(): void
    {
        Sanctum::actingAs($this->student);

        $this->getJson('/api/user/quizzes')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Quiz 1', 'status' => 'not_submitted']);

        $this->getJson('/api/user/quiz/' . $this->quizA->id)->assertOk();
    }

    public function test_quiz_of_a_course_the_student_is_not_enrolled_in_is_hidden(): void
    {
        $otherQuiz = Quiz::create([
            'name' => 'Quiz B',
            'content' => 'quizzes/quizB.pdf',
            'course_id' => $this->courseB->id,
            'published_at' => now(),
        ]);

        Sanctum::actingAs($this->student);

        $this->getJson('/api/user/quiz/' . $otherQuiz->id)->assertStatus(404);
        $this->getJson('/api/user/quizzes')->assertOk()->assertJsonMissing(['name' => 'Quiz B']);
    }

    public function test_student_can_submit_once_and_professor_is_notified(): void
    {
        Sanctum::actingAs($this->student);

        $this->post('/api/user/quiz/' . $this->quizA->id . '/submit', [
            'answer_text' => 'My answer',
        ], ['Accept' => 'application/json'])->assertOk();

        $this->assertDatabaseHas('quiz_submissions', [
            'quiz_id' => $this->quizA->id,
            'student_id' => $this->student->id,
        ]);

        $this->getJson('/api/user/quizzes')->assertOk()->assertJsonFragment(['status' => 'submitted']);

        $this->assertDatabaseHas('notifications', ['professor_id' => $this->professorA->id]);
    }

    public function test_second_submission_is_rejected_by_default(): void
    {
        Sanctum::actingAs($this->student);

        $this->postJson('/api/user/quiz/' . $this->quizA->id . '/submit', ['answer_text' => 'first'])->assertOk();
        $this->postJson('/api/user/quiz/' . $this->quizA->id . '/submit', ['answer_text' => 'second'])->assertStatus(422);
    }

    public function test_resubmission_is_allowed_when_enabled(): void
    {
        Settings::set('quiz_allow_resubmit', 1);

        Sanctum::actingAs($this->student);

        $this->postJson('/api/user/quiz/' . $this->quizA->id . '/submit', ['answer_text' => 'first'])->assertOk();
        $this->postJson('/api/user/quiz/' . $this->quizA->id . '/submit', ['answer_text' => 'second'])->assertOk();

        $this->assertSame(1, QuizSubmission::where('quiz_id', $this->quizA->id)->count());
    }

    public function test_late_submission_is_rejected_by_default(): void
    {
        $this->quizA->update(['due_at' => now()->subDay()]);

        Sanctum::actingAs($this->student);

        $this->postJson('/api/user/quiz/' . $this->quizA->id . '/submit', ['answer_text' => 'late'])->assertStatus(422);
    }

    public function test_late_submission_is_accepted_when_enabled(): void
    {
        Settings::set('quiz_allow_late', 1);
        $this->quizA->update(['due_at' => now()->subDay()]);

        Sanctum::actingAs($this->student);

        $this->postJson('/api/user/quiz/' . $this->quizA->id . '/submit', ['answer_text' => 'late'])->assertOk();
    }

    public function test_submission_requires_a_file_or_text(): void
    {
        Sanctum::actingAs($this->student);

        $this->postJson('/api/user/quiz/' . $this->quizA->id . '/submit', [])->assertStatus(422);
    }

    public function test_upload_validation_rejects_wrong_type_and_oversized_files(): void
    {
        Sanctum::actingAs($this->student);

        $this->post('/api/user/quiz/' . $this->quizA->id . '/submit', [
            'file' => UploadedFile::fake()->create('virus.exe', 10, 'application/x-msdownload'),
        ], ['Accept' => 'application/json'])->assertStatus(422);

        $this->post('/api/user/quiz/' . $this->quizA->id . '/submit', [
            'file' => UploadedFile::fake()->create('big.pdf', 12000, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertStatus(422);

        $this->post('/api/user/quiz/' . $this->quizA->id . '/submit', [
            'file' => UploadedFile::fake()->create('answer.pdf', 20, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertOk();
    }

    public function test_unpaid_student_cannot_submit(): void
    {
        Payment::query()->delete();

        Sanctum::actingAs($this->student);

        $this->postJson('/api/user/quiz/' . $this->quizA->id . '/submit', ['answer_text' => 'x'])->assertStatus(403);
    }

    public function test_professor_can_list_and_grade_submissions_of_own_course(): void
    {
        Sanctum::actingAs($this->student);
        $this->postJson('/api/user/quiz/' . $this->quizA->id . '/submit', ['answer_text' => 'answer'])->assertOk();

        $submission = QuizSubmission::firstOrFail();

        Sanctum::actingAs($this->professorB);
        $this->getJson('/api/quiz/submissions/' . $this->quizA->id)->assertStatus(403);
        $this->postJson('/api/quiz/submission/grade', [
            'submission_id' => $submission->id,
            'score' => 10,
        ])->assertStatus(403);

        Sanctum::actingAs($this->professorA);
        $this->getJson('/api/quiz/submissions/' . $this->quizA->id)->assertOk();

        $this->postJson('/api/quiz/submission/grade', [
            'submission_id' => $submission->id,
            'score' => 18,
            'feedback' => 'Well done',
        ])->assertOk();

        $this->assertDatabaseHas('quiz_submissions', [
            'id' => $submission->id,
            'score' => 18,
        ]);

        $this->assertDatabaseHas('notifications', ['student_id' => $this->student->id]);

        Sanctum::actingAs($this->student);
        $this->getJson('/api/user/quizzes')->assertOk()->assertJsonFragment(['status' => 'graded']);
    }

    public function test_score_cannot_exceed_the_quiz_maximum(): void
    {
        Sanctum::actingAs($this->student);
        $this->postJson('/api/user/quiz/' . $this->quizA->id . '/submit', ['answer_text' => 'answer'])->assertOk();
        $submission = QuizSubmission::firstOrFail();

        Sanctum::actingAs($this->professorA);
        $this->postJson('/api/quiz/submission/grade', [
            'submission_id' => $submission->id,
            'score' => 25,
        ])->assertStatus(422);

        $this->postJson('/api/quiz/submission/grade', [
            'submission_id' => $submission->id,
            'score' => -1,
        ])->assertStatus(422);
    }

    public function test_grading_a_missing_submission_fails_validation(): void
    {
        Sanctum::actingAs($this->professorA);

        $this->postJson('/api/quiz/submission/grade', [
            'submission_id' => 99999,
            'score' => 1,
        ])->assertStatus(422);
    }
}
