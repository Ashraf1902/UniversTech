<?php

namespace App\Http\Controllers\Professor;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Grade;
use App\Models\Semester;
use App\Models\StudentCourse;
use Illuminate\Http\Request;

class GradeProfessorController extends Controller
{
    public function store(Request $request)
    {
        $course = Course::find($request->course_id);

        if (! $course || $course->professor_id !== $request->user()->id) {
            return SendResponse(403, 'You are only allowed to add grades for your own courses.');
        }

        $data = $request->validate([
            'student_id' => 'required|exists:users,id',
            'course_id' => 'required|exists:courses,id',
            'semester_id' => 'nullable|exists:semesters,id',
            'marks' => 'required|numeric|min:0|lte:max_marks',
            'max_marks' => 'required|numeric|gt:0',
        ]);

        $isEnrolled = StudentCourse::where('student_id', $data['student_id'])
            ->where('course_id', $course->id)
            ->exists();

        if (! $isEnrolled) {
            return SendResponse(422, 'Student is not enrolled in this course.');
        }

        $data['semester_id'] = $data['semester_id'] ?? Semester::where('is_active', true)->value('id');

        $grade = Grade::withTrashed()
            ->where('student_id', $data['student_id'])
            ->where('course_id', $course->id)
            ->where('semester_id', $data['semester_id'])
            ->first();

        if ($grade !== null) {
            $grade->restore();
            $grade->update($data);
        } else {
            $grade = Grade::create($data);
        }

        return SendResponse(200, 'Grade saved successfully.', ['grade_id' => $grade->id]);
    }

    public function index(Request $request)
    {
        $request->validate([
            'course_id' => 'required|exists:courses,id',
            'semester_id' => 'nullable|exists:semesters,id',
        ]);

        $course = Course::find($request->course_id);

        if (! $course || $course->professor_id !== $request->user()->id) {
            return SendResponse(403, 'You are not allowed to view grades for this course.');
        }

        $grades = Grade::where('course_id', $course->id)
            ->when($request->filled('semester_id'), fn ($q) => $q->where('semester_id', $request->semester_id))
            ->with(['student', 'course', 'semester'])
            ->orderByDesc('created_at')
            ->paginate(15)
            ->through(fn (Grade $grade) => [
                'id' => $grade->id,
                'student' => $grade->student?->name,
                'course' => $grade->course?->course_name,
                'semester' => $grade->semester?->name,
                'marks' => $grade->marks,
                'max_marks' => $grade->max_marks,
                'percentage' => $grade->max_marks > 0 ? round($grade->marks / $grade->max_marks * 100, 2) : 0,
                'rate' => Grade::percentageToGpa($grade->max_marks > 0 ? $grade->marks / $grade->max_marks * 100 : 0)['letter_grade'],
                'updated_at' => $grade->updated_at,
            ]);

        return SendResponse(200, 'Grades fetched successfully.', $grades);
    }

    public function delete(Request $request, $id)
    {
        $grade = Grade::find($id);

        if (! $grade || ! $grade->course || $grade->course->professor_id !== $request->user()->id) {
            return SendResponse(403, 'You are not allowed to delete this grade.');
        }

        $grade->delete();

        return SendResponse(200, 'Grade archived.');
    }
}