<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Course;
use App\Models\Department;
use App\Models\Level;
use App\Models\Payment;
use App\Models\Quiz;
use App\Models\QuizSubmission;
use App\Models\StudentCourse;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Quiz submissions are confidential: files live on the non-public "private"
 * disk and are only reachable through an authenticated, policy-checked
 * download. This suite covers the authorization matrix, path safety, upload
 * validation and the files:move-private migration command.
 */
class PrivateQuizSubmissionsTest extends TestCase
{
    use RefreshDatabase;

    private Admin $superAdmin;

    private Admin $coursesAdmin;

    private Admin $gradesAdmin;

    private Admin $unrelatedAdmin;

    private Department $department;

    private Level $level;

    private User $professorA;

    private User $professorB;

    private User $student;

    private User $otherStudent;

    private Course $course;

    private Quiz $quiz;

    private QuizSubmission $submission;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('files');
        Storage::fake('private');

        $this->superAdmin = Admin::factory()->create(['is_super_admin' => true]);
        $this->coursesAdmin = Admin::factory()->create(['is_super_admin' => false, 'roles' => ['courses']]);
        $this->gradesAdmin = Admin::factory()->create(['is_super_admin' => false, 'roles' => ['grades']]);
        $this->unrelatedAdmin = Admin::factory()->create(['is_super_admin' => false, 'roles' => ['payments']]);

        $this->department = Department::factory()->create(['admin_id' => $this->superAdmin->id]);
        $this->level = Level::factory()->create();

        $this->professorA = $this->makeProfessor('Professor A');
        $this->professorB = $this->makeProfessor('Professor B');

        $this->course = Course::create([
            'course_name' => 'Algorithms',
            'course_code' => 'CS101',
            'no_of_hours' => 3,
            'department_id' => $this->department->id,
            'professor_id' => $this->professorA->id,
            'admin_id' => $this->superAdmin->id,
        ]);

        $this->quiz = Quiz::create([
            'name' => 'Quiz 1',
            'content' => 'quizzes/quiz1.pdf',
            'course_id' => $this->course->id,
            'max_score' => 20,
            'due_at' => now()->addDay(),
            'published_at' => now(),
        ]);

        $this->student = $this->makeStudent('Owner Student');
        $this->otherStudent = $this->makeStudent('Other Student');

        $this->submission = QuizSubmission::create([
            'quiz_id' => $this->quiz->id,
            'student_id' => $this->student->id,
            'file' => 'quiz-submissions/' . $this->quiz->id . '/answer.pdf',
            'original_name' => 'answer.pdf',
            'submitted_at' => now(),
        ]);

        Storage::disk('private')->put($this->submission->file, 'confidential answer');
    }

    private function makeProfessor(string $name): User
    {
        return User::factory()->create([
            'name' => $name,
            'type' => User::TYPE_PROFESSOR,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ]);
    }

    private function makeStudent(string $name): User
    {
        $student = User::factory()->create([
            'name' => $name,
            'type' => User::TYPE_STUDENT,
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

        StudentCourse::create([
            'student_id' => $student->id,
            'course_id' => $this->course->id,
        ]);

        Payment::forceCreate([
            'user_id' => $student->id,
            'amount' => Payment::PRICE_COURSES,
            'type' => Payment::TYPE_COURSES,
            'status' => Payment::STATUS_PAID,
        ]);

        return $student;
    }

    public function test_owner_student_can_download_with_hardened_headers(): void
    {
        Sanctum::actingAs($this->student);

        $response = $this->get('/api/user/quiz-submissions/' . $this->submission->id . '/download');

        $response->assertOk();
        $response->assertDownload('answer.pdf');
        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertStringContainsString('private', (string) $response->headers->get('Cache-Control'));
        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
    }

    public function test_another_student_cannot_download(): void
    {
        Sanctum::actingAs($this->otherStudent);

        $this->get('/api/user/quiz-submissions/' . $this->submission->id . '/download')
            ->assertStatus(403);
    }

    public function test_assigned_professor_can_download(): void
    {
        Sanctum::actingAs($this->professorA);

        $this->get('/api/quiz/submissions/' . $this->submission->id . '/download')
            ->assertOk()
            ->assertDownload('answer.pdf');
    }

    public function test_unrelated_professor_cannot_download(): void
    {
        Sanctum::actingAs($this->professorB);

        $this->get('/api/quiz/submissions/' . $this->submission->id . '/download')
            ->assertStatus(403);
    }

    public function test_admin_download_respects_courses_and_grades_scopes(): void
    {
        $url = '/api/quiz-submissions/' . $this->submission->id . '/download';

        Sanctum::actingAs($this->unrelatedAdmin);
        $this->get($url)->assertStatus(403);

        Sanctum::actingAs($this->coursesAdmin);
        $this->get($url)->assertOk();

        Sanctum::actingAs($this->gradesAdmin);
        $this->get($url)->assertOk();

        Sanctum::actingAs($this->superAdmin);
        $this->get($url)->assertOk();
    }

    public function test_unauthenticated_download_is_rejected(): void
    {
        $this->getJson('/api/user/quiz-submissions/' . $this->submission->id . '/download')
            ->assertStatus(401);

        $this->getJson('/api/quiz/submissions/' . $this->submission->id . '/download')
            ->assertStatus(401);

        $this->getJson('/api/quiz-submissions/' . $this->submission->id . '/download')
            ->assertStatus(401);
    }

    public function test_path_traversal_in_the_stored_path_is_refused(): void
    {
        Sanctum::actingAs($this->student);

        foreach (['quiz-submissions/../../.env', '/etc/passwd', 'quiz-submissions\\..\\secret.pdf'] as $path) {
            $this->submission->forceFill(['file' => $path])->save();

            $this->get('/api/user/quiz-submissions/' . $this->submission->id . '/download')
                ->assertStatus(404);
        }
    }

    public function test_missing_private_file_returns_404(): void
    {
        Storage::disk('private')->delete($this->submission->file);

        Sanctum::actingAs($this->student);

        $this->get('/api/user/quiz-submissions/' . $this->submission->id . '/download')
            ->assertStatus(404);
    }

    public function test_disallowed_and_oversized_uploads_are_rejected(): void
    {
        Sanctum::actingAs($this->student);

        $this->post('/api/user/quiz/' . $this->quiz->id . '/submit', [
            'file' => UploadedFile::fake()->create('virus.exe', 10, 'application/x-msdownload'),
        ], ['Accept' => 'application/json'])->assertStatus(422);

        $this->post('/api/user/quiz/' . $this->quiz->id . '/submit', [
            'file' => UploadedFile::fake()->create('big.pdf', 12000, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertStatus(422);

        $this->assertDatabaseCount('quiz_submissions', 1);
    }

    public function test_upload_lands_on_the_private_disk_with_a_generated_name(): void
    {
        Storage::disk('private')->delete($this->submission->file);
        $this->submission->delete();

        Sanctum::actingAs($this->student);

        $this->post('/api/user/quiz/' . $this->quiz->id . '/submit', [
            'file' => UploadedFile::fake()->create('My Answer.pdf', 20, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertOk();

        $submission = QuizSubmission::firstOrFail();

        $this->assertMatchesRegularExpression(
            '#^quiz-submissions/' . $this->quiz->id . '/[0-9a-f-]{36}\.pdf$#',
            $submission->file
        );
        $this->assertSame('My Answer.pdf', $submission->original_name);
        $this->assertTrue(Storage::disk('private')->exists($submission->file));
        $this->assertFalse(Storage::disk('files')->exists($submission->file));
    }

    public function test_responses_expose_a_download_url_instead_of_a_public_url(): void
    {
        Sanctum::actingAs($this->student);

        $response = $this->getJson('/api/user/quizzes')->assertOk();

        $response->assertJsonPath('data.data.0.submission.original_name', 'answer.pdf');
        $response->assertJsonPath(
            'data.data.0.submission.download_url',
            '/api/user/quiz-submissions/' . $this->submission->id . '/download'
        );
        $response->assertJsonMissingPath('data.data.0.submission.file');

        Sanctum::actingAs($this->professorA);

        $this->getJson('/api/quiz/submissions/' . $this->quiz->id)
            ->assertOk()
            ->assertJsonPath('data.submissions.data.0.original_name', 'answer.pdf')
            ->assertJsonPath(
                'data.submissions.data.0.download_url',
                '/api/quiz/submissions/' . $this->submission->id . '/download'
            )
            ->assertJsonMissingPath('data.submissions.data.0.file');
    }

    public function test_download_name_is_sanitized(): void
    {
        $this->submission->original_name = '../../etc/passwd';
        $this->assertSame('passwd', $this->submission->downloadName());

        $this->submission->original_name = '..\\..\\evil".pdf';
        $this->assertSame('evil.pdf', $this->submission->downloadName());

        $this->submission->original_name = null;
        $this->submission->forceFill(['file' => 'quiz-submissions/1/uuid.pdf']);
        $this->assertSame('quiz-submission-' . $this->submission->id . '.pdf', $this->submission->downloadName());
    }

    public function test_legacy_public_upload_url_is_not_served(): void
    {
        Storage::disk('files')->put('quiz_submissions/legacy.pdf', 'legacy');

        $this->get('/uploads/quiz_submissions/legacy.pdf')->assertNotFound();
    }

    public function test_move_command_is_a_dry_run_by_default(): void
    {
        $this->makeLegacySubmission();

        $this->artisan('files:move-private')
            ->expectsOutputToContain('would move')
            ->assertExitCode(0);

        $this->assertTrue(Storage::disk('files')->exists('quiz_submissions/legacy.pdf'));
        $this->assertFalse(Storage::disk('private')->exists('quiz-submissions/' . $this->quiz->id . '/legacy.pdf'));
        $this->assertDatabaseHas('quiz_submissions', [
            'id' => $this->submission->id,
            'file' => 'quiz_submissions/legacy.pdf',
        ]);
    }

    public function test_apply_moves_the_file_and_updates_the_row(): void
    {
        $this->makeLegacySubmission();

        $this->artisan('files:move-private', ['--apply' => true])->assertExitCode(0);

        $target = 'quiz-submissions/' . $this->quiz->id . '/legacy.pdf';

        $this->assertTrue(Storage::disk('private')->exists($target));
        $this->assertTrue(Storage::disk('files')->exists('quiz_submissions/legacy.pdf'));
        $this->assertSame('legacy', Storage::disk('private')->get($target));
        $this->assertDatabaseHas('quiz_submissions', ['id' => $this->submission->id, 'file' => $target]);
    }

    public function test_purge_public_removes_the_old_copy_after_a_verified_move(): void
    {
        $this->makeLegacySubmission();

        $this->artisan('files:move-private', ['--apply' => true, '--purge-public' => true])
            ->assertExitCode(0);

        $this->assertTrue(Storage::disk('private')->exists('quiz-submissions/' . $this->quiz->id . '/legacy.pdf'));
        $this->assertFalse(Storage::disk('files')->exists('quiz_submissions/legacy.pdf'));
        $this->get('/uploads/quiz_submissions/legacy.pdf')->assertNotFound();
    }

    public function test_command_is_idempotent_and_dry_run_wins_over_apply(): void
    {
        $this->makeLegacySubmission();

        $this->artisan('files:move-private', ['--apply' => true])->assertExitCode(0);
        $this->artisan('files:move-private', ['--apply' => true])->assertExitCode(0);

        $target = 'quiz-submissions/' . $this->quiz->id . '/legacy.pdf';
        $this->assertTrue(Storage::disk('private')->exists($target));
        $this->assertSame(1, QuizSubmission::where('file', $target)->count());

        // A second row with a legacy path must stay put when --dry-run is also given.
        $legacy = QuizSubmission::create([
            'quiz_id' => $this->quiz->id,
            'student_id' => $this->otherStudent->id,
            'file' => 'quiz_submissions/second.pdf',
            'submitted_at' => now(),
        ]);
        Storage::disk('files')->put('quiz_submissions/second.pdf', 'second');

        $this->artisan('files:move-private', ['--apply' => true, '--dry-run' => true])->assertExitCode(0);

        $this->assertTrue(Storage::disk('files')->exists('quiz_submissions/second.pdf'));
        $this->assertDatabaseHas('quiz_submissions', ['id' => $legacy->id, 'file' => 'quiz_submissions/second.pdf']);
    }

    private function makeLegacySubmission(): void
    {
        Storage::disk('files')->put('quiz_submissions/legacy.pdf', 'legacy');
        $this->submission->forceFill(['file' => 'quiz_submissions/legacy.pdf', 'original_name' => 'legacy.pdf'])->save();
    }
}
