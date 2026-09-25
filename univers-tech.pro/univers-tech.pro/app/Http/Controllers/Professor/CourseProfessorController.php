<?php

namespace App\Http\Controllers\Professor;

use App\Http\Controllers\Controller;
use App\Http\Resources\Professor\ProfessorStudentResource;
use App\Models\Course;
use Illuminate\Http\Request;

class CourseProfessorController extends Controller
{
    public function getProfessorCourses(Request $request)
    {
        $courses = Course::where('professor_id', $request->user()->id)
            ->with(['department', 'lectures'])
            ->orderByDesc('created_at')
            ->paginate(15);

        return SendResponse(200, 'Courses fetched successfully.', $courses);
    }

    public function getCoursesStudent(Request $request)
    {
        $request->validate([
            'course_id' => 'required|exists:courses,id',
        ]);

        $course = Course::find($request->course_id);

        if (! $course || $course->professor_id !== $request->user()->id) {
            return SendResponse(403, 'You are not allowed to view this course.');
        }

        $students = $course->students()
            ->withPivot('course_id', 'student_id')
            ->get()
            ->load(['attendances' => fn ($query) => $query->where('course_id', $course->id)]);

        return SendResponse(
            200,
            'Course students fetched successfully.',
            ProfessorStudentResource::collection($students)
        );
    }
}
