<?php

namespace App\Services;

use App\Jobs\FanOutNotification;
use App\Models\Attendance;
use App\Models\Notification;
use App\Models\StudentCourse;
use App\Models\User;
use App\Support\Settings;

/**
 * Attendance statistics and absence-threshold handling (S2).
 *
 * Percentages are always computed over the student's recorded attendance rows
 * for one course. Threshold notifications are queued and deduplicated per
 * (student, course, threshold) so a student is never spammed while hovering
 * around a threshold.
 */
class AttendanceService
{
    public const STATUS_OK = 'ok';

    public const STATUS_WARNING = 'warning';

    public const STATUS_BARRED = 'barred';

    public const THRESHOLD_WARN = 'warn';

    public const THRESHOLD_BAR = 'bar';

    /**
     * @return array{total:int, present:int, absent:int, absence_percentage:float, status:string, warn_threshold:int, bar_threshold:int, records:array<int, array<string, mixed>>}
     */
    public function stats(int $studentId, int $courseId): array
    {
        $records = Attendance::query()
            ->where('student_id', $studentId)
            ->where('course_id', $courseId)
            ->with('lecture:id,name')
            ->orderByDesc('date')
            ->get();

        return $this->summarize($records, $courseId);
    }

    /**
     * Summarize a collection of attendance rows for one course.
     *
     * @param  iterable<Attendance>  $records
     * @return array{total:int, present:int, absent:int, absence_percentage:float, status:string, warn_threshold:int, bar_threshold:int, records:array<int, array<string, mixed>>}
     */
    public function summarize(iterable $records, int $courseId): array
    {
        $total = 0;
        $present = 0;
        $absent = 0;
        $rows = [];

        foreach ($records as $record) {
            $total++;
            $record->status ? $present++ : $absent++;
            $rows[] = [
                'id' => $record->id,
                'date' => $record->date?->format('Y-m-d'),
                'present' => (bool) $record->status,
                'reason' => $record->reason,
                'lecture' => $record->lecture?->name,
                'recorded_by' => $record->recordedBy?->name,
            ];
        }

        $percentage = $total > 0 ? round($absent / $total * 100, 2) : 0.0;
        $warn = Settings::attendanceWarnThreshold();
        $bar = Settings::attendanceBarThreshold();

        $status = self::STATUS_OK;
        if ($percentage >= $bar) {
            $status = self::STATUS_BARRED;
        } elseif ($percentage >= $warn) {
            $status = self::STATUS_WARNING;
        }

        return [
            'total' => $total,
            'present' => $present,
            'absent' => $absent,
            'absence_percentage' => $percentage,
            'status' => $status,
            'warn_threshold' => $warn,
            'bar_threshold' => $bar,
            'records' => $rows,
        ];
    }

    /**
     * Queue one notification per crossed threshold (once per course forever).
     */
    public function notifyThresholds(int $studentId, int $courseId): array
    {
        $stats = $this->stats($studentId, $courseId);

        if ($stats['total'] === 0) {
            return [];
        }

        $courseName = \App\Models\Course::find($courseId)?->course_name ?? 'a course';
        $sent = [];

        if ($stats['status'] === self::STATUS_BARRED) {
            if ($this->markAlert($studentId, $courseId, self::THRESHOLD_BAR)) {
                $sent[] = self::THRESHOLD_BAR;
            }
            if ($this->markAlert($studentId, $courseId, self::THRESHOLD_WARN)) {
                $sent[] = self::THRESHOLD_WARN;
            }
        } elseif ($stats['status'] === self::STATUS_WARNING) {
            if ($this->markAlert($studentId, $courseId, self::THRESHOLD_WARN)) {
                $sent[] = self::THRESHOLD_WARN;
            }
        }

        foreach ($sent as $threshold) {
            $barred = $threshold === self::THRESHOLD_BAR;
            FanOutNotification::dispatch([[
                'student_id' => $studentId,
                'title' => $barred ? 'Exam bar: absence threshold reached' : 'Absence warning',
                'content' => $barred
                    ? 'Your absence in "' . $courseName . '" has reached ' . $stats['absence_percentage'] . '% (threshold ' . $stats['bar_threshold'] . '%). You are currently marked as exam barred for this course.'
                    : 'Your absence in "' . $courseName . '" is now ' . $stats['absence_percentage'] . '% (warning threshold ' . $stats['warn_threshold'] . '%).',
                'type' => Notification::TYPE_NOTIFICATION,
                'created_at' => now(),
                'updated_at' => now(),
            ]]);
        }

        return $sent;
    }

    /**
     * Record the alert so it is never sent twice; true when newly recorded.
     */
    private function markAlert(int $studentId, int $courseId, string $threshold): bool
    {
        $alert = \App\Models\AttendanceThresholdAlert::query()
            ->where('student_id', $studentId)
            ->where('course_id', $courseId)
            ->where('threshold', $threshold)
            ->first();

        if ($alert !== null) {
            return false;
        }

        \App\Models\AttendanceThresholdAlert::create([
            'student_id' => $studentId,
            'course_id' => $courseId,
            'threshold' => $threshold,
            'notified_at' => now(),
        ]);

        return true;
    }

    /**
     * Per-course summary for every course the student is registered in.
     *
     * @return array<int, array<string, mixed>>
     */
    public function studentCourses(int $studentId): array
    {
        $enrollments = StudentCourse::query()
            ->where('student_id', $studentId)
            ->where('status', StudentCourse::STATUS_REGISTERED)
            ->with('course:id,course_name,course_code,no_of_hours')
            ->get();

        return $enrollments->map(function (StudentCourse $enrollment) use ($studentId) {
            $stats = $this->stats($studentId, $enrollment->course_id);

            return [
                'course_id' => $enrollment->course_id,
                'course_name' => $enrollment->course?->course_name,
                'course_code' => $enrollment->course?->course_code,
                'total' => $stats['total'],
                'present' => $stats['present'],
                'absent' => $stats['absent'],
                'absence_percentage' => $stats['absence_percentage'],
                'status' => $stats['status'],
                'warn_threshold' => $stats['warn_threshold'],
                'bar_threshold' => $stats['bar_threshold'],
                'records' => $stats['records'],
            ];
        })->values()->all();
    }

    /**
     * Absence summary per registered student of a course (professor/admin views).
     *
     * @return array<int, array<string, mixed>>
     */
    public function courseRoster(int $courseId): array
    {
        $students = \App\Models\Course::find($courseId)
            ?->students()
            ->wherePivot('status', StudentCourse::STATUS_REGISTERED)
            ->with('id,name,email')
            ->get(['users.id', 'users.name', 'users.email']);

        if ($students === null) {
            return [];
        }

        return $students->map(function (User $student) use ($courseId) {
            $stats = $this->stats($student->id, $courseId);

            return [
                'id' => $student->id,
                'name' => $student->name,
                'total' => $stats['total'],
                'present' => $stats['present'],
                'absent' => $stats['absent'],
                'absence_percentage' => $stats['absence_percentage'],
                'status' => $stats['status'],
            ];
        })->values()->all();
    }
}
