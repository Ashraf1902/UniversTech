<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\StudentCourse;
use App\Models\User;
use App\Services\EnrollmentService;
use Illuminate\Http\Request;

class EnrollmentAdminController extends Controller
{
    public function __construct(private EnrollmentService $enrollment)
    {
    }

    /**
     * Students currently enrolled in a course.
     */
    public function students(Request $request)
    {
        $request->validate([
            'course_id' => 'required|exists:courses,id',
        ]);

        $course = Course::findOrFail($request->course_id);

        $enrollments = StudentCourse::where('course_id', $course->id)
            ->registered()
            ->with('student')
            ->orderByDesc('created_at')
            ->paginate(15)
            ->through(fn (StudentCourse $enrollment) => [
                'id' => $enrollment->id,
                'student_id' => $enrollment->student_id,
                'name' => $enrollment->student?->name,
                'email' => $enrollment->student?->email,
                'status' => $enrollment->status,
                'progress' => $enrollment->progress,
                'enrolled_at' => $enrollment->created_at,
            ]);

        return SendResponse(200, 'Enrolled students fetched successfully.', $enrollments);
    }

    /**
     * Manually enroll a student (A4). May bypass enrollment rules with override.
     */
    public function enroll(Request $request)
    {
        $data = $request->validate([
            'course_id' => 'required|exists:courses,id',
            'student_id' => 'required|exists:users,id',
            'override' => 'sometimes|boolean',
            'note' => ['nullable', 'string', 'max:1000', 'required_if:override,true'],
        ]);

        $student = User::find($data['student_id']);

        if (! $student || ! $student->isStudent()) {
            return SendResponse(422, 'Selected account is not a student.');
        }

        $course = Course::findOrFail($data['course_id']);

        $result = $this->enrollment->register($student, [$course->id], [
            'override' => (bool) ($data['override'] ?? false),
            'note' => $data['note'] ?? null,
            'actor' => $request->user(),
        ]);

        if (! $result['success']) {
            return SendResponse(422, 'Unable to enroll the student.', ['errors' => $result['errors']]);
        }

        return SendResponse(200, 'Student enrolled successfully.', ['registered' => $result['registered']]);
    }

    /**
     * Remove a student from a course (admin override).
     */
    public function unenroll(Request $request)
    {
        $data = $request->validate([
            'course_id' => 'required|exists:courses,id',
            'student_id' => 'required|exists:users,id',
            'note' => 'nullable|string|max:1000',
        ]);

        $student = User::findOrFail($data['student_id']);
        $course = Course::findOrFail($data['course_id']);

        $result = $this->enrollment->drop($student, $course, [
            'override' => true,
            'note' => $data['note'] ?? null,
            'actor' => $request->user(),
        ]);

        if (! $result['success']) {
            return SendResponse(422, 'Student is not registered in this course.');
        }

        return SendResponse(200, 'Student unenrolled successfully.');
    }
}
