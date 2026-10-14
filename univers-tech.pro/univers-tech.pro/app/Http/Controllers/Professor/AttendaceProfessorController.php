<?php

namespace App\Http\Controllers\Professor;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAttendaceRequest;
use App\Models\Attendance;
use App\Models\Lecture;
use App\Models\StudentCourse;
use App\Traits\AuthorizesCourseOwnership;
use App\Traits\Notifiable;

class AttendaceProfessorController extends Controller
{
    use AuthorizesCourseOwnership, Notifiable;

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

        Attendance::create([
            'date' => $request->date,
            'status' => $request->status,
            'reason' => $request->reason,
            'student_id' => $request->student_id,
            'professor_id' => $request->user()->id,
            'lec_id' => $request->lecture_id,
            'course_id' => $course->id,
        ]);

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
}
