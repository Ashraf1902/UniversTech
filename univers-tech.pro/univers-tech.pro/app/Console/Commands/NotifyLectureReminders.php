<?php

namespace App\Console\Commands;

use App\Models\Notification;
use App\Models\Schedule;
use App\Models\Semester;
use App\Models\StudentCourse;
use App\Models\User;
use Illuminate\Console\Command;

class NotifyLectureReminders extends Command
{
    protected $signature = 'notify:lecture-reminders';

    protected $description = 'Send students a daily notification about their lectures from the active semester schedule.';

    public function handle(): int
    {
        $activeSemester = Semester::where('is_active', true)->first();

        if (! $activeSemester) {
            $this->info('No active semester - skipping lecture reminders.');

            return self::SUCCESS;
        }

        $today = strtolower(now()->format('l'));

        $schedules = Schedule::where('semester_id', $activeSemester->id)
            ->with('course')
            ->get()
            ->filter(fn (Schedule $schedule) => strtolower((string) $schedule->day_of_week) === $today);

        if ($schedules->isEmpty()) {
            $this->info('No lectures scheduled for today.');

            return self::SUCCESS;
        }

        $students = User::where('type', User::TYPE_STUDENT)
            ->with(['studentCourses', 'student'])
            ->get();

        $rows = [];

        foreach ($students as $student) {
            $registeredCourseIds = $student->studentCourses->pluck('course_id')->all();

            foreach ($schedules as $schedule) {
                if (! in_array($schedule->course_id, $registeredCourseIds, true)) {
                    continue;
                }

                if ($student->student?->department_id !== null
                    && $schedule->department_id !== null
                    && $schedule->department_id !== $student->student?->department_id) {
                    continue;
                }

                if ($student->student?->level_id !== null && $schedule->level_id !== $student->student?->level_id) {
                    continue;
                }

                $start = $schedule->start_time?->format('H:i') ?? '';
                $end = $schedule->end_time?->format('H:i') ?? '';

                $rows[] = [
                    'student_id' => $student->id,
                    'professor_id' => null,
                    'title' => 'Lecture reminder',
                    'content' => 'You have "' . ($schedule->course->course_name ?? 'a lecture')
                        . ' (' . $schedule->section_type . ')" today at ' . $start
                        . ($end ? ' - ' . $end : '') . '.',
                    'type' => Notification::TYPE_NOTIFICATION,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
        }

        if (! empty($rows)) {
            \App\Jobs\FanOutNotification::dispatch($rows);

            $this->info('Queued ' . count($rows) . ' lecture reminder notifications.');
        } else {
            $this->info('No matching students for today\'s lectures.');
        }

        return self::SUCCESS;
    }
}