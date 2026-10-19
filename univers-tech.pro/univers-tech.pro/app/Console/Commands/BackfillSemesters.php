<?php

namespace App\Console\Commands;

use App\Models\Course;
use App\Models\Semester;
use App\Models\StudentCourse;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillSemesters extends Command
{
    protected $signature = 'data:backfill-semesters
        {--semester= : Target semester id (defaults to the active semester)}
        {--dry-run : Report what would change without writing anything}';

    protected $description = 'Assign a semester to legacy courses and enrollments that have none (NULL). Rows that already have a semester are never touched.';

    public function handle(): int
    {
        $semesterId = $this->option('semester');

        $semester = $semesterId
            ? Semester::find($semesterId)
            : Semester::where('is_active', true)->first();

        if (! $semester) {
            $this->error('No target semester found. Pass --semester=ID or activate a semester first.');

            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');

        $coursesBefore = Course::whereNull('semester_id')->count();
        $enrollmentsBefore = StudentCourse::whereNull('semester_id')->count();

        $this->info("Target semester: #{$semester->id} — {$semester->name} ({$semester->academic_year})");
        $this->line("Before — courses with NULL semester: {$coursesBefore}; enrollments with NULL semester: {$enrollmentsBefore}");

        if ($dryRun) {
            $this->warn("[dry-run] Would assign {$coursesBefore} course(s) and {$enrollmentsBefore} enrollment(s) to semester #{$semester->id}. No rows changed.");

            return self::SUCCESS;
        }

        DB::transaction(function () use ($semester) {
            Course::whereNull('semester_id')->update(['semester_id' => $semester->id]);
            StudentCourse::whereNull('semester_id')->update(['semester_id' => $semester->id]);
        });

        $coursesAfter = Course::whereNull('semester_id')->count();
        $enrollmentsAfter = StudentCourse::whereNull('semester_id')->count();

        $this->info("Assigned legacy rows to semester #{$semester->id}.");
        $this->line("After — courses with NULL semester: {$coursesAfter}; enrollments with NULL semester: {$enrollmentsAfter}");

        return self::SUCCESS;
    }
}
