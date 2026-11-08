<?php

namespace App\Http\Controllers\Professor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Professor\ProfessorBulkAttendanceRequest;
use App\Http\Requests\StoreAttendaceRequest;
use App\Http\Requests\UpdateAttendaceRequest;
use App\Models\Attendance;
use App\Models\Lecture;
use App\Models\StudentCourse;
use App\Services\AttendanceService;
use App\Support\Settings;
use App\Traits\AuthorizesCourseOwnership;
use App\Traits\Notifiable;
use Illuminate\Support\Facades\DB;

class AttendaceProfessorController extends Controller
{
    use AuthorizesCourseOwnership, Notifiable;

    public function __construct(private AttendanceService $attendanceStats)
    {
    }

    public function storeAttendace(StoreAttendaceRequest $request)
    {
        $lecture = Lecture::with('course')->find($request->lecture_id);

        if (! $lecture || ! $lecture->course) {
            return SendResponse(404, 'Lecture not found.');
        }

        $course = $lecture->course;

        if ($blocked = $this->authorizeCourseOwnership($request, $course, 'You are not allowed to take attendance for this course.')) {
            return $blocked;
        }

        $isEnrolled = $course->students()
            ->wherePivot('student_id', $request->student_id)
            ->wherePivot('status', StudentCourse::STATUS_REGISTERED)
            ->exists();

        if (! $isEnrolled) {
            return SendResponse(404, 'Student is not enrolled in this course.');
        }

        $alreadyRecorded = Attendance::where('student_id', $request->student_id)
            ->where('lec_id', $request->lecture_id)
            ->exists();

        if ($alreadyRecorded) {
            return SendResponse(409, 'Attendance for this student has already been recorded.');
        }

        $record = Attendance::create([
            'date' => $request->date,
            'status' => $request->status,
            'reason' => $request->reason,
            'student_id' => $request->student_id,
            'professor_id' => $request->user()->id,
            'lec_id' => $request->lecture_id,
            'course_id' => $course->id,
            'recorded_by_type' => $request->user()->getMorphClass(),
            'recorded_by_id' => $request->user()->id,
        ]);

        $this->attendanceStats->notifyThresholds((int) $record->student_id, (int) $course->id);

        if (! $request->status) {
            $this->notifyStudent(
                $request->student_id,
                'Absence recorded',
                'You have been marked absent for "' . $course->course_name . '" on ' . $request->date . '.',
                $request->user()->id
            );
        }

        $this->notifyAdmin(
            'Attendance recorded',
            $request->user()->name . ' recorded attendance for "' . $course->course_name . '".'
        );

        return SendResponse(201, 'Attendance recorded successfully.');
    }

    /**
     * Save attendance for a whole class in one call, scoped to one lecture.
     *
     * Every row is validated before anything is written (ownership, enrollment,
     * the correction window and duplicate students), then the create/update
     * pass runs inside a single transaction. Additive: the single-student
     * endpoints keep their existing behaviour.
     */
    public function storeBulkAttendance(ProfessorBulkAttendanceRequest $request)
    {
        $lecture = Lecture::with('course')->find($request->lecture_id);

        if (! $lecture || ! $lecture->course) {
            return SendResponse(404, 'Lecture not found.');
        }

        $course = $lecture->course;

        if ($blocked = $this->authorizeCourseOwnership($request, $course, 'You are not allowed to take attendance for this course.')) {
            return $blocked;
        }

        $rows = collect($request->input('attendances'))
            ->map(fn ($row) => [
                'student_id' => (int) $row['student_id'],
                'status' => (bool) $row['status'],
                'reason' => $row['reason'] ?? null,
            ])
            ->values();

        $studentIds = $rows->pluck('student_id')->all();

        $enrolled = $course->students()
            ->wherePivot('status', StudentCourse::STATUS_REGISTERED)
            ->whereIn('users.id', $studentIds)
            ->pluck('users.id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $notEnrolled = array_values(array_diff($studentIds, $enrolled));

        if (! empty($notEnrolled)) {
            return SendResponse(
                422,
                'These students are not registered in this course: ' . implode(', ', $notEnrolled) . '. No attendance was saved.'
            );
        }

        $existing = Attendance::where('lec_id', $lecture->id)
            ->whereIn('student_id', $studentIds)
            ->get()
            ->keyBy('student_id');

        $windowHours = Settings::attendanceEditWindowHours();
        $stale = $existing->filter(
            fn (Attendance $attendance) => $attendance->created_at->copy()->addHours($windowHours)->isPast()
        )->keys();

        if ($stale->isNotEmpty()) {
            return SendResponse(
                403,
                'The attendance correction window (' . $windowHours . ' hours) has passed for ' . $stale->count()
                . ' student(s). Only an administrator can change those records now. Nothing was saved.'
            );
        }

        $created = 0;
        $updated = 0;

        DB::transaction(function () use ($rows, $existing, $lecture, $course, $request, &$created, &$updated) {
            foreach ($rows as $row) {
                $attributes = [
                    'date' => $request->date,
                    'status' => $row['status'],
                    'reason' => $row['reason'],
                    'professor_id' => $request->user()->id,
                    'course_id' => $course->id,
                    'recorded_by_type' => $request->user()->getMorphClass(),
                    'recorded_by_id' => $request->user()->id,
                ];

                $attendance = $existing->get($row['student_id']);

                if ($attendance) {
                    $attendance->update($attributes);
                    $updated++;

                    continue;
                }

                Attendance::create($attributes + [
                    'student_id' => $row['student_id'],
                    'lec_id' => $lecture->id,
                ]);
                $created++;
            }
        });

        foreach ($rows as $row) {
            $this->attendanceStats->notifyThresholds($row['student_id'], (int) $course->id);

            if (! $row['status']) {
                $this->notifyStudent(
                    $row['student_id'],
                    'Absence recorded',
                    'You have been marked absent for "' . $course->course_name . '" on ' . $request->date . '.',
                    $request->user()->id
                );
            }
        }

        if ($rows->contains(fn ($row) => ! $row['status'])) {
            $this->notifyAdmin(
                'Attendance recorded',
                $request->user()->name . ' saved attendance for "' . $course->course_name . '" ('
                . $created . ' new, ' . $updated . ' updated).'
            );
        }

        return SendResponse(200, 'Attendance saved successfully.', [
            'created' => $created,
            'updated' => $updated,
            'total' => $rows->count(),
        ]);
    }

    /**
     * Professor correction of their own attendance record, bounded by the
     * attendance edit window (P5). After the window only an admin may change it.
     */
    public function updateAttendace(UpdateAttendaceRequest $request)
    {
        $attendance = Attendance::find($request->attendance_id);

        if (! $attendance) {
            return SendResponse(404, 'Attendance not found.');
        }

        $lecture = Lecture::with('course')->find($attendance->lec_id);

        if (! $lecture || ! $lecture->course) {
            return SendResponse(404, 'Lecture not found.');
        }

        if ($blocked = $this->authorizeCourseOwnership($request, $lecture->course, 'You are not allowed to edit attendance for this course.')) {
            return $blocked;
        }

        $windowHours = Settings::attendanceEditWindowHours();

        $withinWindow = $attendance->created_at
            ->copy()
            ->addHours($windowHours)
            ->isFuture();

        if (! $withinWindow) {
            return SendResponse(403, 'The attendance correction window (' . $windowHours . ' hours) has passed. Only an administrator can change this record now.');
        }

        $attendance->update([
            'date' => $request->date,
            'status' => $request->status,
            'reason' => $request->reason,
            'recorded_by_type' => $request->user()->getMorphClass(),
            'recorded_by_id' => $request->user()->id,
        ]);

        $this->attendanceStats->notifyThresholds((int) $attendance->student_id, (int) $attendance->course_id);

        if (! $request->status) {
            $this->notifyStudent(
                (int) $attendance->student_id,
                'Absence recorded',
                'You have been marked absent for "' . $lecture->course->course_name . '" on ' . $request->date . '.',
                $request->user()->id
            );
        }

        return SendResponse(200, 'Attendance updated successfully.');
    }
}
