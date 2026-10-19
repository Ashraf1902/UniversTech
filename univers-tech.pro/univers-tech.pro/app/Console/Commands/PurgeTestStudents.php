<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PurgeTestStudents extends Command
{
    protected $signature = 'data:purge-test-students
        {--apply : Actually delete the matched accounts (default is a dry run)}
        {--email=* : Email address to target; repeatable. Defaults to the known test accounts}';

    protected $description = 'Remove the legacy test student accounts and their enrollments. Runs as a dry run unless --apply is given.';

    /**
     * The throwaway accounts seeded during early testing. Kept here so the
     * command is explicit and reviewable rather than deleting "every student
     * without a demo domain", which could match real users.
     */
    private const DEFAULT_EMAILS = [
        'student@test.com',
        'student2@universtech.edu',
        'student3@universtech.edu',
        'student4@universtech.edu',
        'student5@universtech.edu',
        'student6@universtech.edu',
        'student7@universtech.edu',
        'student8@universtech.edu',
        'student9@universtech.edu',
        'student10@universtech.edu',
    ];

    public function handle(): int
    {
        $emails = $this->option('email') ?: self::DEFAULT_EMAILS;
        $apply = (bool) $this->option('apply');

        $users = User::query()->whereIn('email', $emails)->get();

        if ($users->isEmpty()) {
            $this->info('No matching accounts found. Nothing to do.');

            return self::SUCCESS;
        }

        $ids = $users->pluck('id')->all();

        $this->info(($apply ? 'Removing' : '[dry-run] Would remove') . ' ' . count($ids) . ' account(s):');
        foreach ($users as $user) {
            $this->line("  #{$user->id}  {$user->email}");
        }

        $counts = [
            'student_courses' => DB::table('student_courses')->whereIn('student_id', $ids)->count(),
            'payments' => DB::table('payments')->whereIn('user_id', $ids)->count(),
            'grades' => DB::table('grades')->whereIn('student_id', $ids)->count(),
            'attendances' => DB::table('attendances')->whereIn('student_id', $ids)->count(),
            'student_lectures' => DB::table('student_lectures')->whereIn('student_id', $ids)->count(),
            'grade_appeals' => DB::table('grade_appeals')->whereIn('student_id', $ids)->count(),
            'student_promotions' => DB::table('student_promotions')->whereIn('student_id', $ids)->count(),
            'notifications' => DB::table('notifications')->whereIn('student_id', $ids)->count(),
            'students' => DB::table('students')->whereIn('user_id', $ids)->count(),
        ];

        $this->newLine();
        $this->line('Linked rows that would be removed (by cascade or explicitly):');
        foreach ($counts as $table => $count) {
            $this->line("  {$table}: {$count}");
        }

        if (! $apply) {
            $this->newLine();
            $this->warn('[dry-run] No rows changed. Re-run with --apply to delete.');
            $this->line('Example: php artisan data:purge-test-students --apply --env=wasmer');

            return self::SUCCESS;
        }

        DB::transaction(function () use ($ids) {
            // The users table is soft-deleted, which would leave enrollments
            // and payments behind. Force-delete so the FK cascades actually
            // run and every linked row is removed.
            User::withTrashed()->whereIn('id', $ids)->forceDelete();
        });

        $remaining = User::withTrashed()->whereIn('id', $ids)->count();
        $this->newLine();
        $this->info("Deleted " . count($ids) . " account(s). Remaining with those ids: {$remaining}.");

        return $remaining === 0 ? self::SUCCESS : self::FAILURE;
    }
}
