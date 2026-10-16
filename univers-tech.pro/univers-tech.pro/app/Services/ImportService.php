<?php

namespace App\Services;

use App\Mail\ResetPasswordMail;
use App\Models\Admin;
use App\Models\Course;
use App\Models\Department;
use App\Models\Level;
use App\Models\Semester;
use App\Models\User;
use App\Support\PasswordRealm;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

/**
 * Bulk CSV import for students and courses (A2).
 *
 * Files are parsed from their temporary upload path and never persisted.
 * Nothing is written to the database until {@see apply()} runs, and every
 * chunk is wrapped in a transaction so a partial failure never leaves the
 * database in a broken state.
 *
 * The import is "all valid rows or report": rows that fail validation (or are
 * duplicates of an existing record / of an earlier row in the same file) are
 * skipped and returned so the admin can download them as an error file.
 */
class ImportService
{
    public const TYPE_STUDENTS = 'students';

    public const TYPE_COURSES = 'courses';

    public const MAX_ROWS = 2000;

    public const CHUNK_SIZE = 200;

    public const MAX_FILE_KB = 2048;

    /**
     * The exact template columns per import type (order matters for the
     * downloadable template; uploads are matched by header name).
     *
     * @var array<string, array<int, string>>
     */
    public const HEADERS = [
        self::TYPE_STUDENTS => ['name', 'email', 'gender', 'nationalid', 'phone', 'department_id', 'level_id', 'semester'],
        self::TYPE_COURSES => ['course_name', 'course_code', 'no_of_hours', 'capacity', 'department_id', 'professor_email', 'semester_id'],
    ];

    /**
     * @var array<string, array<int, string>>
     */
    private const SAMPLE = [
        self::TYPE_STUDENTS => ['Sara Ahmed', 'sara.ahmed@example.com', 'female', '29901011234567', '01012345678', '1', '1', 'first'],
        self::TYPE_COURSES => ['Data Structures', 'CS201', '3', '60', '1', 'professor@example.com', '1'],
    ];

    /**
     * @return array<int, string>
     */
    public function headers(string $type): array
    {
        return self::HEADERS[$type] ?? [];
    }

    /**
     * @return array<int, string>
     */
    public function sampleRow(string $type): array
    {
        return self::SAMPLE[$type] ?? [];
    }

    public function template(string $type): string
    {
        $lines = [
            implode(',', $this->headers($type)),
            implode(',', $this->sampleRow($type)),
        ];

        return implode("\r\n", $lines) . "\r\n";
    }

    /**
     * Parse an uploaded CSV into rows keyed by template column.
     *
     * @return array{rows: array<int, array<string, string>>, missing: array<int, string>}
     */
    public function parse(UploadedFile $file, string $type): array
    {
        $expected = $this->headers($type);
        $handle = fopen($file->getRealPath(), 'r');

        if ($handle === false) {
            return ['rows' => [], 'missing' => $expected];
        }

        $positions = null;
        $rows = [];
        $line = 0;

        while (($data = fgetcsv($handle, 0, ',', '"', '\\')) !== false) {
            $line++;

            if ($positions === null) {
                $header = array_map(
                    fn ($value) => strtolower(trim((string) $value)),
                    $data
                );
                // Strip a UTF-8 BOM from the first header cell.
                if (isset($header[0])) {
                    $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]);
                }

                $positions = [];
                foreach ($expected as $column) {
                    $index = array_search($column, $header, true);
                    $positions[$column] = $index === false ? null : $index;
                }

                continue;
            }

            if ($this->isBlank($data)) {
                continue;
            }

            $record = ['_row' => (string) $line];
            foreach ($expected as $column) {
                $index = $positions[$column];
                $record[$column] = $index !== null && isset($data[$index])
                    ? trim((string) $data[$index])
                    : '';
            }

            $rows[] = $record;
        }

        fclose($handle);

        $missing = $positions === null
            ? $expected
            : array_values(array_filter($expected, fn ($column) => $positions[$column] === null));

        return ['rows' => $rows, 'missing' => $missing];
    }

    /**
     * Validate every row without writing anything.
     *
     * @param  array<int, array<string, string>>  $rows
     * @return array{rows: array<int, array<string, mixed>>, summary: array<string, int>}
     */
    public function preview(string $type, array $rows): array
    {
        $seen = [];
        $out = [];
        $valid = 0;
        $invalid = 0;

        foreach ($rows as $row) {
            $result = $type === self::TYPE_STUDENTS
                ? $this->validateStudent($row, $seen)
                : $this->validateCourse($row, $seen);

            $result['valid'] ? $valid++ : $invalid++;
            $out[] = $result;
        }

        return [
            'rows' => $out,
            'summary' => [
                'total' => count($out),
                'valid' => $valid,
                'invalid' => $invalid,
            ],
        ];
    }

    /**
     * Validate then persist the file's rows in transactional chunks.
     *
     * @param  array<int, array<string, string>>  $rows
     * @return array{imported: int, skipped: int, errors: array<int, array<string, mixed>>}
     */
    public function apply(string $type, array $rows, ?Model $actor = null): array
    {
        $preview = $this->preview($type, $rows);

        $valid = [];
        $errors = [];

        foreach ($preview['rows'] as $row) {
            if ($row['valid']) {
                $valid[] = $row;
            } else {
                $errors[] = ['row' => $row['row'], 'errors' => $row['errors']];
            }
        }

        $imported = 0;
        $createdEmails = [];

        foreach (array_chunk($valid, self::CHUNK_SIZE) as $chunk) {
            DB::beginTransaction();

            try {
                foreach ($chunk as $item) {
                    if ($type === self::TYPE_STUDENTS) {
                        $this->createStudent($item['data'], $actor);
                    } else {
                        $this->createCourse($item['data'], $actor);
                    }
                }

                DB::commit();
                $imported += count($chunk);

                if ($type === self::TYPE_STUDENTS) {
                    foreach ($chunk as $item) {
                        $createdEmails[] = $item['data']['email'];
                    }
                }
            } catch (\Throwable $e) {
                DB::rollBack();

                foreach ($chunk as $item) {
                    $errors[] = [
                        'row' => $item['row'],
                        'errors' => ['Could not be imported: ' . $e->getMessage()],
                    ];
                }
            }
        }

        if ($createdEmails !== []) {
            $this->queuePasswordSetEmails($createdEmails);
        }

        return [
            'imported' => $imported,
            'skipped' => count($errors),
            'errors' => $errors,
        ];
    }

    /**
     * @param  array<string, string>  $row
     * @param  array<string, array<string, bool>>  $seen
     * @return array<string, mixed>
     */
    private function validateStudent(array $row, array &$seen): array
    {
        $errors = [];
        $name = $row['name'];
        $email = $row['email'];

        if ($name === '') {
            $errors[] = 'Name is required.';
        } elseif (mb_strlen($name) > 255) {
            $errors[] = 'Name must not exceed 255 characters.';
        }

        if ($email === '') {
            $errors[] = 'Email is required.';
        } elseif (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'Email is not valid.';
        } elseif (User::withTrashed()->where('email', $email)->exists()) {
            $errors[] = 'Email is already registered.';
        } elseif (isset($seen['email'][strtolower($email)])) {
            $errors[] = 'Email is duplicated inside this file.';
        }

        $gender = $this->normalizeGender($row['gender']);
        if ($gender === null) {
            $errors[] = 'Gender must be male or female.';
        }

        $nationalId = $row['nationalid'];
        if ($nationalId !== '') {
            if (! preg_match('/^\d{14}$/', $nationalId)) {
                $errors[] = 'National ID must be exactly 14 digits.';
            } elseif (User::withTrashed()->where('nationalid', $nationalId)->exists()) {
                $errors[] = 'National ID is already registered.';
            } elseif (isset($seen['nationalid'][$nationalId])) {
                $errors[] = 'National ID is duplicated inside this file.';
            }
        }

        $phone = $row['phone'];
        if ($phone !== '') {
            if (! preg_match('/^\d{11}$/', $phone)) {
                $errors[] = 'Phone must be exactly 11 digits.';
            } elseif (User::withTrashed()->where('phone', $phone)->exists()) {
                $errors[] = 'Phone is already registered.';
            } elseif (isset($seen['phone'][$phone])) {
                $errors[] = 'Phone is duplicated inside this file.';
            }
        }

        $departmentId = $this->optionalId($row['department_id']);
        if ($row['department_id'] !== '' && $departmentId === null) {
            $errors[] = 'Department ID must be a number.';
        } elseif ($departmentId !== null && ! Department::whereKey($departmentId)->exists()) {
            $errors[] = 'Department ID does not exist.';
        }

        $levelId = $this->optionalId($row['level_id']);
        if ($row['level_id'] !== '' && $levelId === null) {
            $errors[] = 'Level ID must be a number.';
        } elseif ($levelId !== null && ! Level::whereKey($levelId)->exists()) {
            $errors[] = 'Level ID does not exist.';
        }

        $semester = $this->normalizeSemester($row['semester']);
        if ($row['semester'] !== '' && $semester === null) {
            $errors[] = 'Semester must be "first" or "second".';
        }

        if ($errors === []) {
            $seen['email'][strtolower($email)] = true;
            if ($nationalId !== '') {
                $seen['nationalid'][$nationalId] = true;
            }
            if ($phone !== '') {
                $seen['phone'][$phone] = true;
            }
        }

        return [
            'row' => (int) $row['_row'],
            'valid' => $errors === [],
            'errors' => $errors,
            'data' => [
                'name' => $name,
                'email' => $email,
                'gender' => $gender ?? false,
                'nationalid' => $nationalId !== '' ? $nationalId : null,
                'phone' => $phone !== '' ? $phone : null,
                'department_id' => $departmentId,
                'level_id' => $levelId,
                'semester' => $semester,
            ],
        ];
    }

    /**
     * @param  array<string, string>  $row
     * @param  array<string, array<string, bool>>  $seen
     * @return array<string, mixed>
     */
    private function validateCourse(array $row, array &$seen): array
    {
        $errors = [];
        $courseName = $row['course_name'];
        $code = $row['course_code'];

        if ($courseName === '') {
            $errors[] = 'Course name is required.';
        } elseif (mb_strlen($courseName) > 255) {
            $errors[] = 'Course name must not exceed 255 characters.';
        }

        if ($code === '') {
            $errors[] = 'Course code is required.';
        } elseif (mb_strlen($code) > 255) {
            $errors[] = 'Course code must not exceed 255 characters.';
        } elseif (Course::withTrashed()->where('course_code', $code)->exists()) {
            $errors[] = 'Course code is already used.';
        } elseif (isset($seen['course_code'][$code])) {
            $errors[] = 'Course code is duplicated inside this file.';
        }

        $hours = $this->optionalId($row['no_of_hours']);
        if ($row['no_of_hours'] === '') {
            $errors[] = 'Number of hours is required.';
        } elseif ($hours === null || $hours < 1) {
            $errors[] = 'Number of hours must be a positive integer.';
        }

        $capacity = null;
        if ($row['capacity'] !== '') {
            $capacity = $this->optionalId($row['capacity']);
            if ($capacity === null) {
                $errors[] = 'Capacity must be zero or a positive integer.';
            }
        }

        $departmentId = $this->optionalId($row['department_id']);
        if ($row['department_id'] !== '' && $departmentId === null) {
            $errors[] = 'Department ID must be a number.';
        } elseif ($departmentId !== null && ! Department::whereKey($departmentId)->exists()) {
            $errors[] = 'Department ID does not exist.';
        }

        $semesterId = $this->optionalId($row['semester_id']);
        if ($row['semester_id'] !== '' && $semesterId === null) {
            $errors[] = 'Semester ID must be a number.';
        } elseif ($semesterId !== null && ! Semester::whereKey($semesterId)->exists()) {
            $errors[] = 'Semester ID does not exist.';
        }

        $professorId = null;
        $professorEmail = $row['professor_email'];
        if ($professorEmail !== '') {
            if (! filter_var($professorEmail, FILTER_VALIDATE_EMAIL)) {
                $errors[] = 'Professor email is not valid.';
            } else {
                $professor = User::where('email', $professorEmail)
                    ->where('type', User::TYPE_PROFESSOR)
                    ->first();

                if ($professor === null) {
                    $errors[] = 'No professor account exists for that email.';
                } else {
                    $professorId = $professor->id;
                }
            }
        }

        if ($errors === []) {
            $seen['course_code'][$code] = true;
        }

        return [
            'row' => (int) $row['_row'],
            'valid' => $errors === [],
            'errors' => $errors,
            'data' => [
                'course_name' => $courseName,
                'course_code' => $code,
                'no_of_hours' => $hours,
                'capacity' => $capacity,
                'department_id' => $departmentId,
                'professor_id' => $professorId,
                'semester_id' => $semesterId,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function createStudent(array $data, ?Model $actor): void
    {
        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make(Str::random(40)),
            'gender' => $data['gender'],
            'nationalid' => $data['nationalid'],
            'phone' => $data['phone'],
            'type' => User::TYPE_STUDENT,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $actor instanceof Admin ? $actor->id : null,
        ]);

        $user->student()->create([
            'department_id' => $data['department_id'],
            'level_id' => $data['level_id'],
            'semester' => $data['semester'],
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function createCourse(array $data, ?Model $actor): void
    {
        Course::create([
            'course_name' => $data['course_name'],
            'no_of_hours' => $data['no_of_hours'],
            'course_code' => $data['course_code'],
            'cover_image' => 'default.jpg',
            'department_id' => $data['department_id'],
            'professor_id' => $data['professor_id'],
            'admin_id' => $actor instanceof Admin ? $actor->id : null,
            'semester_id' => $data['semester_id'],
            'capacity' => $data['capacity'],
        ]);
    }

    /**
     * Queue a password-set link (Stage 3 flow) for each freshly created
     * student so nobody ever receives a shared or default password.
     *
     * @param  array<int, string>  $emails
     */
    private function queuePasswordSetEmails(array $emails): void
    {
        $students = User::whereIn('email', $emails)
            ->where('type', User::TYPE_STUDENT)
            ->get();

        foreach ($students as $student) {
            $token = Password::broker(PasswordRealm::broker(PasswordRealm::STUDENT))->createToken($student);

            Mail::to($student->email)->queue(new ResetPasswordMail(
                (string) ($student->name ?? 'there'),
                PasswordRealm::resetUrl(PasswordRealm::STUDENT, (string) $student->email, $token),
                PasswordRealm::STUDENT,
            ));
        }
    }

    private function normalizeGender(string $value): ?bool
    {
        $normalized = strtolower(trim($value));

        if (in_array($normalized, ['female', 'f', '1', 'true'], true)) {
            return true;
        }

        if (in_array($normalized, ['male', 'm', '0', 'false'], true)) {
            return false;
        }

        return null;
    }

    private function normalizeSemester(string $value): ?string
    {
        $normalized = strtolower(trim($value));

        return in_array($normalized, ['first', 'second'], true) ? $normalized : null;
    }

    private function optionalId(string $value): ?int
    {
        $value = trim($value);

        if ($value === '' || ! preg_match('/^\d+$/', $value)) {
            return null;
        }

        return (int) $value;
    }

    /**
     * @param  array<int, string|null>  $data
     */
    private function isBlank(array $data): bool
    {
        foreach ($data as $value) {
            if (trim((string) $value) !== '') {
                return false;
            }
        }

        return true;
    }
}
