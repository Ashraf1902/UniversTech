<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Course;
use App\Models\Department;
use App\Models\Level;
use App\Models\Semester;
use App\Models\User;
use App\Mail\ResetPasswordMail;
use App\Services\ImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ImportTest extends TestCase
{
    use RefreshDatabase;

    private const STUDENT_HEADERS = ['name', 'email', 'gender', 'nationalid', 'phone', 'department_id', 'level_id', 'semester'];

    private const COURSE_HEADERS = ['course_name', 'course_code', 'no_of_hours', 'capacity', 'department_id', 'professor_email', 'semester_id'];

    private Admin $superAdmin;

    private Department $department;

    private Level $level;

    private Semester $semester;

    private User $professor;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = Admin::factory()->create(['id' => 1, 'is_super_admin' => true]);
        $this->department = Department::factory()->create(['admin_id' => $this->superAdmin->id]);
        $this->level = Level::factory()->create();
        $this->semester = Semester::create([
            'name' => 'First',
            'academic_year' => '2026/2027',
            'is_active' => true,
        ]);

        $this->professor = User::factory()->create([
            'type' => User::TYPE_PROFESSOR,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
            'email' => 'professor@university.edu',
        ]);
    }

    private function actingAsAdmin(array $roles): Admin
    {
        $admin = Admin::factory()->create(['is_super_admin' => false, 'roles' => $roles]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    /**
     * Build a CSV payload from a list of row arrays.
     *
     * @param  array<int, array<int, string>>  $rows
     */
    private function csv(array $headers, array $rows): string
    {
        $all = array_merge([$headers], $rows);

        return collect($all)
            ->map(fn (array $row) => implode(',', $row))
            ->implode("\n") . "\n";
    }

    private function studentRow(array $overrides = []): array
    {
        return array_values(array_merge([
            'name' => 'Imported Student',
            'email' => 'imported@example.com',
            'gender' => 'female',
            'nationalid' => '',
            'phone' => '',
            'department_id' => (string) $this->department->id,
            'level_id' => (string) $this->level->id,
            'semester' => 'first',
        ], $overrides));
    }

    private function courseRow(array $overrides = []): array
    {
        return array_values(array_merge([
            'course_name' => 'Imported Course',
            'course_code' => 'IMP101',
            'no_of_hours' => '3',
            'capacity' => '60',
            'department_id' => (string) $this->department->id,
            'professor_email' => $this->professor->email,
            'semester_id' => (string) $this->semester->id,
        ], $overrides));
    }

    private function upload(string $name, string $content): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, $content);
    }

    public function test_students_template_downloads_with_the_exact_columns(): void
    {
        $this->actingAsAdmin(['accounts']);

        $response = $this->get('/api/import/students/template');

        $response->assertOk();

        $body = $response->streamedContent();
        $this->assertStringContainsString(implode(',', self::STUDENT_HEADERS), $body);
        $this->assertStringContainsString('sara.ahmed@example.com', $body);
    }

    public function test_courses_template_downloads_with_the_exact_columns(): void
    {
        $this->actingAsAdmin(['courses']);

        $response = $this->get('/api/import/courses/template');

        $response->assertOk();

        $body = $response->streamedContent();
        $this->assertStringContainsString(implode(',', self::COURSE_HEADERS), $body);
        $this->assertStringContainsString('CS201', $body);
    }

    public function test_preview_validates_rows_without_writing_anything(): void
    {
        $this->actingAsAdmin(['accounts']);

        $csv = $this->csv(self::STUDENT_HEADERS, [
            $this->studentRow(),
            $this->studentRow(['name' => 'Broken', 'email' => 'not-an-email']),
        ]);

        $this->post('/api/import/students/preview', ['file' => $this->upload('students.csv', $csv)])
            ->assertOk()
            ->assertJsonPath('data.summary.total', 2)
            ->assertJsonPath('data.summary.valid', 1)
            ->assertJsonPath('data.summary.invalid', 1)
            ->assertJsonPath('data.rows.0.valid', true)
            ->assertJsonPath('data.rows.1.valid', false);

        // Only the professor created in setUp; the preview wrote nothing.
        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('students', 0);
    }

    public function test_preview_reports_the_reason_for_each_invalid_row(): void
    {
        $this->actingAsAdmin(['accounts']);

        $csv = $this->csv(self::STUDENT_HEADERS, [
            $this->studentRow(['email' => 'bad-email']),
            $this->studentRow(['name' => '', 'gender' => 'unknown']),
        ]);

        $response = $this->post('/api/import/students/preview', ['file' => $this->upload('students.csv', $csv)])
            ->assertOk()
            ->assertJsonPath('data.summary.valid', 0)
            ->assertJsonPath('data.summary.invalid', 2);

        $errors = $response->json('data.rows.0.errors');
        $this->assertNotEmpty($errors);
        $this->assertStringContainsString('Email is not valid', $errors[0]);

        $genderErrors = $response->json('data.rows.1.errors');
        $this->assertTrue(
            collect($genderErrors)->contains(fn ($message) => str_contains($message, 'Gender'))
        );
    }

    public function test_preview_flags_rows_that_clash_with_existing_accounts(): void
    {
        $existing = User::factory()->create([
            'type' => User::TYPE_STUDENT,
            'email' => 'already@exists.com',
            'nationalid' => '29901011111111',
            'phone' => '01099999999',
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ]);

        $this->actingAsAdmin(['accounts']);

        $csv = $this->csv(self::STUDENT_HEADERS, [
            $this->studentRow(['email' => 'already@exists.com']),
            $this->studentRow(['nationalid' => '29901011111111']),
            $this->studentRow(['phone' => '01099999999']),
        ]);

        $response = $this->post('/api/import/students/preview', ['file' => $this->upload('students.csv', $csv)])
            ->assertOk()
            ->assertJsonPath('data.summary.valid', 0)
            ->assertJsonPath('data.summary.invalid', 3);

        $this->assertTrue(
            collect($response->json('data.rows.0.errors'))->contains(fn ($m) => str_contains($m, 'already registered'))
        );
        $this->assertSame($existing->id, User::where('email', 'already@exists.com')->first()->id);
    }

    public function test_preview_flags_duplicates_inside_the_same_file(): void
    {
        $this->actingAsAdmin(['accounts']);

        $csv = $this->csv(self::STUDENT_HEADERS, [
            $this->studentRow(['email' => 'dup@example.com']),
            $this->studentRow(['email' => 'dup@example.com']),
        ]);

        $response = $this->post('/api/import/students/preview', ['file' => $this->upload('students.csv', $csv)])
            ->assertOk()
            ->assertJsonPath('data.summary.valid', 1)
            ->assertJsonPath('data.summary.invalid', 1);

        $this->assertTrue(
            collect($response->json('data.rows.1.errors'))->contains(fn ($m) => str_contains($m, 'duplicated inside this file'))
        );
    }

    public function test_apply_creates_the_user_and_the_student_profile_row(): void
    {
        Mail::fake();

        $this->actingAsAdmin(['accounts']);

        $csv = $this->csv(self::STUDENT_HEADERS, [
            $this->studentRow([
                'email' => 'new.student@university.edu',
                'nationalid' => '29901019999999',
                'phone' => '01088888888',
            ]),
        ]);

        $this->post('/api/import/students/apply', ['file' => $this->upload('students.csv', $csv)])
            ->assertOk()
            ->assertJsonPath('data.imported', 1)
            ->assertJsonPath('data.skipped', 0);

        $user = User::where('email', 'new.student@university.edu')->first();
        $this->assertNotNull($user);
        $this->assertTrue($user->isStudent());

        $profile = $user->student;
        $this->assertNotNull($profile);
        $this->assertSame($this->department->id, $profile->department_id);
        $this->assertSame($this->level->id, $profile->level_id);
        $this->assertSame('first', $profile->semester);
    }

    public function test_imported_students_get_a_random_password_and_a_queued_password_set_email(): void
    {
        Mail::fake();

        $this->actingAsAdmin(['accounts']);

        $csv = $this->csv(self::STUDENT_HEADERS, [
            $this->studentRow(['email' => 'mailme@example.com']),
        ]);

        $this->post('/api/import/students/apply', ['file' => $this->upload('students.csv', $csv)])
            ->assertOk();

        $user = User::where('email', 'mailme@example.com')->first();
        $this->assertNotNull($user);

        // Never a fixed default password.
        $this->assertNotSame('password', $user->password);
        $this->assertNotSame('12345678', $user->password);
        $this->assertNotSame('', $user->password);

        Mail::assertQueued(ResetPasswordMail::class, 1);
    }

    public function test_apply_skips_the_bad_rows_and_imports_the_rest(): void
    {
        $this->actingAsAdmin(['accounts']);

        $csv = $this->csv(self::STUDENT_HEADERS, [
            $this->studentRow(['email' => 'good1@example.com']),
            $this->studentRow(['email' => 'bad-email']),
            $this->studentRow(['email' => 'good2@example.com']),
        ]);

        $response = $this->post('/api/import/students/apply', ['file' => $this->upload('students.csv', $csv)])
            ->assertOk()
            ->assertJsonPath('data.imported', 2)
            ->assertJsonPath('data.skipped', 1);

        $this->assertDatabaseHas('users', ['email' => 'good1@example.com']);
        $this->assertDatabaseHas('users', ['email' => 'good2@example.com']);
        $this->assertDatabaseMissing('users', ['email' => 'bad-email']);

        $this->assertCount(1, $response->json('data.errors'));
    }

    public function test_apply_is_processed_in_chunks(): void
    {
        Mail::fake();

        $this->actingAsAdmin(['accounts']);

        $rows = [];
        for ($i = 1; $i <= ImportService::CHUNK_SIZE + 5; $i++) {
            $rows[] = $this->studentRow(['name' => 'Bulk ' . $i, 'email' => 'bulk' . $i . '@example.com']);
        }

        $this->post('/api/import/students/apply', ['file' => $this->upload('students.csv', $this->csv(self::STUDENT_HEADERS, $rows))])
            ->assertOk()
            ->assertJsonPath('data.imported', ImportService::CHUNK_SIZE + 5)
            ->assertJsonPath('data.skipped', 0);

        $this->assertSame(
            ImportService::CHUNK_SIZE + 5,
            User::where('type', User::TYPE_STUDENT)->count()
        );
        $this->assertDatabaseCount('students', ImportService::CHUNK_SIZE + 5);
    }

    public function test_course_import_creates_courses_and_resolves_the_professor(): void
    {
        $this->actingAsAdmin(['courses']);

        $csv = $this->csv(self::COURSE_HEADERS, [
            $this->courseRow(['course_name' => 'Algorithms', 'course_code' => 'ALG201']),
        ]);

        $this->post('/api/import/courses/apply', ['file' => $this->upload('courses.csv', $csv)])
            ->assertOk()
            ->assertJsonPath('data.imported', 1);

        $course = Course::where('course_code', 'ALG201')->first();
        $this->assertNotNull($course);
        $this->assertSame('Algorithms', $course->course_name);
        $this->assertSame($this->professor->id, $course->professor_id);
        $this->assertSame($this->department->id, $course->department_id);
        $this->assertSame(60, $course->capacity);
    }

    public function test_course_import_rejects_rows_whose_professor_does_not_exist(): void
    {
        $this->actingAsAdmin(['courses']);

        $csv = $this->csv(self::COURSE_HEADERS, [
            $this->courseRow(['course_code' => 'NOPROF01', 'professor_email' => 'nobody@nowhere.com']),
            $this->courseRow(['course_code' => 'OKPROF01']),
        ]);

        $response = $this->post('/api/import/courses/apply', ['file' => $this->upload('courses.csv', $csv)])
            ->assertOk()
            ->assertJsonPath('data.imported', 1)
            ->assertJsonPath('data.skipped', 1);

        $this->assertDatabaseMissing('courses', ['course_code' => 'NOPROF01']);
        $this->assertDatabaseHas('courses', ['course_code' => 'OKPROF01']);

        $this->assertTrue(
            collect($response->json('data.errors.0.errors'))->contains(fn ($m) => str_contains($m, 'No professor account'))
        );
    }

    public function test_students_import_requires_the_accounts_scope(): void
    {
        $this->actingAsAdmin(['courses']);

        $csv = $this->csv(self::STUDENT_HEADERS, [$this->studentRow()]);

        $this->post('/api/import/students/preview', ['file' => $this->upload('students.csv', $csv)])
            ->assertStatus(403);
        $this->post('/api/import/students/apply', ['file' => $this->upload('students.csv', $csv)])
            ->assertStatus(403);
        $this->get('/api/import/students/template')->assertStatus(403);

        $this->assertSame(0, User::where('type', User::TYPE_STUDENT)->count());
    }

    public function test_course_import_requires_the_courses_scope(): void
    {
        $this->actingAsAdmin(['accounts']);

        $csv = $this->csv(self::COURSE_HEADERS, [$this->courseRow()]);

        $this->post('/api/import/courses/preview', ['file' => $this->upload('courses.csv', $csv)])
            ->assertStatus(403);
        $this->post('/api/import/courses/apply', ['file' => $this->upload('courses.csv', $csv)])
            ->assertStatus(403);
        $this->get('/api/import/courses/template')->assertStatus(403);

        $this->assertDatabaseCount('courses', 0);
    }

    public function test_import_is_rejected_when_the_headers_do_not_match_the_template(): void
    {
        $this->actingAsAdmin(['accounts']);

        $csv = $this->csv(['name', 'email'], [['Someone', 'someone@example.com']]);

        $this->post('/api/import/students/preview', ['file' => $this->upload('students.csv', $csv)])
            ->assertStatus(422)
            ->assertJsonPath('data.missing_columns.0', 'gender');

        $this->post('/api/import/students/apply', ['file' => $this->upload('students.csv', $csv)])
            ->assertStatus(422);

        $this->assertSame(0, User::where('type', User::TYPE_STUDENT)->count());
    }

    public function test_import_is_rejected_for_non_csv_files(): void
    {
        $this->actingAsAdmin(['accounts']);

        $file = UploadedFile::fake()->create('students.xlsx', 10);

        $this->post('/api/import/students/preview', ['file' => $file])
            ->assertStatus(422);

        $this->assertSame(0, User::where('type', User::TYPE_STUDENT)->count());
    }

    public function test_a_completed_import_is_written_to_the_audit_log(): void
    {
        Mail::fake();

        $admin = $this->actingAsAdmin(['accounts']);

        $csv = $this->csv(self::STUDENT_HEADERS, [
            $this->studentRow(['email' => 'audited@example.com']),
            $this->studentRow(['email' => 'bad-email']),
        ]);

        $this->post('/api/import/students/apply', ['file' => $this->upload('students.csv', $csv)])
            ->assertOk();

        $log = \App\Models\ActivityLog::where('action', 'data_imported')->first();
        $this->assertNotNull($log);

        $properties = $log->properties;
        $this->assertSame('students', $properties['type']);
        $this->assertSame(1, $properties['imported']);
        $this->assertSame(1, $properties['skipped']);
        $this->assertSame($admin->id, $log->actor_id);
    }
}
