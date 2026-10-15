<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreAttendanceRequest;
use App\Http\Requests\Admin\UpdateAttendanceRequest;
use App\Models\Attendance;
use App\Models\Course;
use App\Models\Lecture;
use App\Models\StudentCourse;
use App\Services\AttendanceService;
use App\Traits\Notifiable;
use Illuminate\Http\Request;

class AttendanceAdminController extends Controller
{
    use Notifiable;

    public function __construct(private AttendanceService $attendanceStats)
    {
    }

    /**
     * Lightweight course picker for the attendance page (scoped group already
     * gates access, so this does not require the `courses` scope too).
     */
    public function courses()
    {
        $courses = Course::query()
            ->with(['professor:id,name', 'department:id,name', 'semester:id,name'])
            ->orderBy('course_name')
            ->get(['id', 'course_name', 'course_code', 'professor_id', 'department_id', 'semester_id'])
            ->map(fn (Course $course) => [
                'id' => $course->id,
                'course_name' => $course->course_name,
                'course_code' => $course->course_code,
                'professor' => $course->professor?->name,
                'department' => $course->department?->name,
                'semester' => $course->semester?->name,
            ]);

        return SendResponse(200, 'Courses fetched successfully.', $courses);
    }

    public function lectures(Request $request)
    {
        $request->validate(['course_id' => 'required|exists:courses,id']);

        $lectures = Lecture::where('course_id', $request->course_id)
            ->orderBy('id')
            ->get(['id', 'name', 'course_id'])
            ->map(fn (Lecture $lecture) => [
                'id' => $lecture->id,
                'name' => $lecture->name,
                'course_id' => $lecture->course_id,
            ]);

        return SendResponse(200, 'Lectures fetched successfully.', $lectures);
    }

    /**
     * Registered students of a course, with their existing attendance for an
     * optional lecture so the page can show what is already marked.
     */
    public function roster(Request $request)
    {
        $request->validate([
            'course_id' => 'required|exists:courses,id',
            'lecture_id' => 'nullable|exists:lectures,id',
        ]);

        $students = Course::find($request->course_id)
            ->students()
            ->wherePivot('status', StudentCourse::STATUS_REGISTERED)
            ->withPivot('course_id', 'student_id')
            ->orderBy('name')
            ->get(['users.id', 'users.name', 'users.email'])
            ->map(function ($student) use ($request) {
                $attendance = $request->filled('lecture_id')
                    ? Attendance::where('student_id', $student->id)
                        ->where('lec_id', $request->lecture_id)
                        ->first()
                    : null;

                $summary = $this->attendanceStats->stats((int) $student->id, (int) $request->course_id);

                return [
                    'id' => $student->id,
                    'name' => $student->name,
                    'email' => $student->email,
                    'attendance_id' => $attendance?->id,
                    'present' => $attendance ? (bool) $attendance->status : null,
                    'reason' => $attendance?->reason,
                    'recorded_by' => $attendance?->recordedBy?->name,
                    'absence_percentage' => $summary['absence_percentage'],
                    'absent_count' => $summary['absent'],
                    'present_count' => $summary['present'],
                    'status' => $summary['status'],
                    'warn_threshold' => $summary['warn_threshold'],
                    'bar_threshold' => $summary['bar_threshold'],
                ];
            });

        return SendResponse(200, 'Course roster fetched successfully.', $students);
    }

    public function index(Request $request)
    {
        $request->validate([
            'course_id' => 'nullable|exists:courses,id',
            'lecture_id' => 'nullable|exists:lectures,id',
            'student_id' => 'nullable|exists:users,id',
            'status' => 'nullable|in:present,absent',
            'search' => 'nullable|string|max:200',
            'deleted' => 'nullable|boolean',
        ]);

        $records = ($request->boolean('deleted') ? Attendance::onlyTrashed() : Attendance::query())
            ->with(['student:id,name,email', 'professor:id,name', 'lecture.course:id,course_name,course_code', 'course:id,course_name,course_code', 'recordedBy:id,name'])
            ->when($request->filled('course_id'), fn ($q) => $q->where('course_id', $request->course_id))
            ->when($request->filled('lecture_id'), fn ($q) => $q->where('lec_id', $request->lecture_id))
            ->when($request->filled('student_id'), fn ($q) => $q->where('student_id', $request->student_id))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status === 'present'))
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = $request->search;
                $q->where(function ($qq) use ($term) {
                    $qq->whereHas('student', fn ($s) => $s->where('name', 'like', "%{$term}%")->orWhere('email', 'like', "%{$term}%"))
                        ->orWhereHas('lecture.course', fn ($c) => $c->where('course_name', 'like', "%{$term}%")->orWhere('course_code', 'like', "%{$term}%"))
                        ->orWhereHas('lecture', fn ($l) => $l->where('name', 'like', "%{$term}%"));
                });
            })
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->paginate(15)
            ->through(fn (Attendance $record) => $this->formatAttendance($record));

        return SendResponse(200, 'Attendance fetched successfully.', $records);
    }

    public function store(StoreAttendanceRequest $request)
    {
        $lecture = Lecture::with('course')->find($request->lecture_id);

        if (! $lecture || ! $lecture->course) {
            return SendResponse(404, 'Lecture not found.');
        }

        $course = $lecture->course;

        $isEnrolled = $course->students()
            ->wherePivot('student_id', $request->student_id)
            ->wherePivot('status', StudentCourse::STATUS_REGISTERED)
            ->exists();

        if (! $isEnrolled) {
            return SendResponse(404, 'Student is not enrolled in this course.');
        }

        $existing = Attendance::where('student_id', $request->student_id)
            ->where('lec_id', $request->lecture_id)
            ->first();

        if ($existing) {
            $existing->update([
                'date' => $request->date,
                'status' => $request->boolean('status'),
                'reason' => $request->reason,
                'course_id' => $course->id,
                'recorded_by_type' => $request->user()->getMorphClass(),
                'recorded_by_id' => $request->user()->id,
            ]);

            $this->notifyIfAbsent($existing, $course, $request);
            $this->attendanceStats->notifyThresholds((int) $existing->student_id, (int) $course->id);

            return SendResponse(200, 'Attendance updated successfully.', $this->formatAttendance($existing->fresh($this->relations())));
        }

        $record = Attendance::create([
            'date' => $request->date,
            'status' => $request->boolean('status'),
            'reason' => $request->reason,
            'student_id' => $request->student_id,
            'professor_id' => $course->professor_id,
            'lec_id' => $request->lecture_id,
            'course_id' => $course->id,
            'recorded_by_type' => $request->user()->getMorphClass(),
            'recorded_by_id' => $request->user()->id,
        ]);

        $this->notifyIfAbsent($record, $course, $request);
        $this->attendanceStats->notifyThresholds((int) $record->student_id, (int) $course->id);

        return SendResponse(201, 'Attendance recorded successfully.', $this->formatAttendance($record->load($this->relations())));
    }

    public function update(UpdateAttendanceRequest $request)
    {
        $attendance = Attendance::findOrFail($request->attendance_id);
        $old = ['status' => (bool) $attendance->status, 'reason' => $attendance->reason, 'date' => $attendance->date?->format('Y-m-d')];

        $attendance->update([
            'date' => $request->date,
            'status' => $request->boolean('status'),
            'reason' => $request->reason,
            'recorded_by_type' => $request->user()->getMorphClass(),
            'recorded_by_id' => $request->user()->id,
        ]);

        $this->attendanceStats->notifyThresholds((int) $attendance->student_id, (int) $attendance->course_id);

        return SendResponse(200, 'Attendance updated successfully.', [
            'attendance' => $this->formatAttendance($attendance->fresh($this->relations())),
            'previous' => $old,
        ]);
    }

    public function delete(Request $request, $id)
    {
        $attendance = Attendance::find($id);

        if (! $attendance) {
            return SendResponse(404, 'Attendance not found.');
        }

        $attendance->delete();

        return SendResponse(200, 'Attendance archived, can be restored later.');
    }

    public function restore(Request $request, $id)
    {
        $attendance = Attendance::onlyTrashed()->find($id);

        if (! $attendance) {
            return SendResponse(404, 'Archived attendance not found.');
        }

        $attendance->restore();

        $this->attendanceStats->notifyThresholds((int) $attendance->student_id, (int) $attendance->course_id);

        return SendResponse(200, 'Attendance restored successfully.');
    }

    private function relations(): array
    {
        return ['student:id,name,email', 'professor:id,name', 'lecture.course:id,course_name,course_code', 'course:id,course_name,course_code', 'recordedBy:id,name'];
    }

    private function notifyIfAbsent(Attendance $record, Course $course, Request $request): void
    {
        if ($record->status) {
            return;
        }

        $this->notifyStudent(
            (int) $record->student_id,
            'Absence recorded',
            'You have been marked absent for "' . $course->course_name . '" on ' . $record->date?->format('Y-m-d') . '.',
            $course->professor_id
        );
    }

    private function formatAttendance(Attendance $attendance): array
    {
        return [
            'id' => $attendance->id,
            'student_id' => $attendance->student_id,
            'student' => $attendance->student?->name,
            'student_email' => $attendance->student?->email,
            'professor_id' => $attendance->professor_id,
            'professor' => $attendance->professor?->name,
            'lecture_id' => $attendance->lec_id,
            'lecture' => $attendance->lecture?->name,
            'course_id' => $attendance->course_id,
            'course' => $attendance->course?->course_name ?? $attendance->lecture?->course?->course_name,
            'course_code' => $attendance->course?->course_code ?? $attendance->lecture?->course?->course_code,
            'date' => $attendance->date?->format('Y-m-d'),
            'status' => (bool) $attendance->status,
            'present' => (bool) $attendance->status,
            'reason' => $attendance->reason,
            'recorded_by' => $attendance->recordedBy?->name,
            'recorded_by_type' => $attendance->recorded_by_type,
            'recorded_by_id' => $attendance->recorded_by_id,
            'created_at' => $attendance->created_at,
            'updated_at' => $attendance->updated_at,
            'deleted_at' => $attendance->deleted_at,
        ];
    }
}
