<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Grade;
use App\Models\Semester;
use App\Models\StudentCourse;
use App\Models\User;
use Illuminate\Http\Request;

class GradeAdminController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'student_id' => 'nullable|exists:users,id',
            'course_id' => 'nullable|exists:courses,id',
            'semester_id' => 'nullable|exists:semesters,id',
        ]);

        $grades = ($request->boolean('deleted') ? Grade::onlyTrashed() : Grade::query())
            ->with(['student', 'course', 'semester'])
            ->when($request->filled('student_id'), fn ($q) => $q->where('student_id', $request->student_id))
            ->when($request->filled('course_id'), fn ($q) => $q->where('course_id', $request->course_id))
            ->when($request->filled('semester_id'), fn ($q) => $q->where('semester_id', $request->semester_id))
            ->orderByDesc('created_at')
            ->paginate(15)
            ->through(fn (Grade $grade) => $this->formatGrade($grade));

        return SendResponse(200, 'Grades fetched successfully.', $grades);
    }

    public function store(Request $request)
    {
        $data = $this->validatedInput($request);

        $grade = $this->upsertGrade($data);

        return SendResponse(200, 'Grade saved successfully.', $this->formatGrade($grade->load(['student', 'course', 'semester'])));
    }

    private function upsertGrade(array $data): Grade
    {
        $existing = Grade::withTrashed()
            ->where('student_id', $data['student_id'])
            ->where('course_id', $data['course_id'])
            ->where('semester_id', $data['semester_id'])
            ->first();

        if ($existing !== null) {
            $existing->restore();
            $existing->update($data);

            return $existing;
        }

        return Grade::create($data);
    }

    public function update(Request $request)
    {
        $data = $this->validatedInput($request);

        $grade = Grade::findOrFail($request->grade_id);
        $grade->update($data);

        return SendResponse(200, 'Grade updated successfully.', $this->formatGrade($grade->load(['student', 'course', 'semester'])));
    }

    public function delete(Request $request, $id)
    {
        $grade = Grade::find($id);

        if (! $grade) {
            return SendResponse(404, 'Grade not found.');
        }

        $grade->delete();

        return SendResponse(200, 'Grade archived, can be restored later.');
    }

    public function restore(Request $request, $id)
    {
        $grade = Grade::onlyTrashed()->find($id);

        if (! $grade) {
            return SendResponse(404, 'Archived grade not found.');
        }

        $grade->restore();

        return SendResponse(200, 'Grade restored successfully.');
    }

    public function purge(Request $request, $id)
    {
        if (! $request->user()->isSuperAdmin()) {
            return SendResponse(403, 'Only a super admin can permanently delete grades.');
        }

        $grade = Grade::withTrashed()->find($id);

        if (! $grade) {
            return SendResponse(404, 'Grade not found.');
        }

        $grade->forceDelete();

        return SendResponse(200, 'Grade permanently deleted.');
    }

    public function semesterCard(Request $request)
    {
        $request->validate([
            'student_id' => 'required|exists:users,id',
            'semester_id' => 'nullable|exists:semesters,id',
        ]);

        $student = User::with('department', 'level')->find($request->student_id);

        $semester = $request->filled('semester_id')
            ? Semester::find($request->semester_id)
            : Semester::where('is_active', true)->first();

        if (! $semester) {
            return SendResponse(404, 'No semester found. Create and activate a semester first.');
        }

        $enrollments = StudentCourse::where('student_id', $student->id)
            ->with(['course.semester', 'course.department'])
            ->get()
            ->filter(fn (StudentCourse $enrollment) => $enrollment->course->semester_id === $semester->id)
            ->values();

        $gradesByCourse = Grade::where('student_id', $student->id)
            ->where('semester_id', $semester->id)
            ->get()
            ->keyBy('course_id');

        $rows = $enrollments->map(function (StudentCourse $enrollment) use ($gradesByCourse) {
            $grade = $gradesByCourse->get($enrollment->course_id);

            return [
                'course_id' => $enrollment->course_id,
                'course_name' => $enrollment->course->course_name,
                'course_code' => $enrollment->course->course_code,
                'credit_hours' => $enrollment->course->no_of_hours,
                'marks' => $grade?->marks,
                'max_marks' => $grade?->max_marks,
                'percentage' => $grade ? round($grade->marks / $grade->max_marks * 100, 2) : null,
                'status' => $grade ? 'graded' : 'pending',
            ];
        });

        return SendResponse(200, 'Semester card fetched successfully.', [
            'student' => [
                'id' => $student->id,
                'name' => $student->name,
                'email' => $student->email,
                'level' => $student->level?->name,
                'department' => $student->department?->name,
            ],
            'semester' => [
                'id' => $semester->id,
                'name' => $semester->name,
                'academic_year' => $semester->academic_year,
                'grading_system' => $semester->grading_system,
            ],
            'summary' => $this->summary($rows, $semester),
            'courses' => $rows,
        ]);
    }

    private function summary($rows, Semester $semester): array
    {
        $graded = $rows->filter(fn ($row) => $row['status'] === 'graded');

        if ($graded->isEmpty()) {
            return [
                'graded_courses' => 0,
                'total_courses' => $rows->count(),
                'total_credit_hours' => $rows->sum('credit_hours'),
                'gpa' => null,
                'percentage' => null,
                'grade' => null,
            ];
        }

        $totalCredit = $graded->sum('credit_hours');

        if ($semester->grading_system === 'fixed_term') {
            $percentage = $graded->sum('percentage') / $graded->count();
            $gpaRow = Grade::percentageToGpa($percentage);

            return [
                'graded_courses' => $graded->count(),
                'total_courses' => $rows->count(),
                'total_credit_hours' => $totalCredit,
                'gpa' => null,
                'percentage' => round($percentage, 2),
                'grade' => $gpaRow['letter_grade'],
            ];
        }

        $qualityPoints = 0.0;

        foreach ($graded as $row) {
            $points = Grade::percentageToGpa($row['percentage'])['gpa_points'];
            $qualityPoints += $points * $row['credit_hours'];
        }

        $gpa = $totalCredit > 0 ? round($qualityPoints / $totalCredit, 2) : 0;

        return [
            'graded_courses' => $graded->count(),
            'total_courses' => $rows->count(),
            'total_credit_hours' => $totalCredit,
            'gpa' => $gpa,
            'percentage' => null,
            'grade' => Grade::gpaToLetter($gpa),
        ];
    }

    private function validatedInput(Request $request): array
    {
        return $request->validate([
            'student_id' => 'required|exists:users,id',
            'course_id' => 'required|exists:courses,id',
            'semester_id' => ['nullable', 'exists:semesters,id'],
            'marks' => 'required|numeric|min:0|lte:max_marks',
            'max_marks' => 'required|numeric|gt:0',
        ]);
    }

    private function formatGrade(Grade $grade): array
    {
        $percentage = $grade->max_marks > 0 ? round($grade->marks / $grade->max_marks * 100, 2) : 0;
        $gradeRow = Grade::percentageToGpa($percentage);

        return [
            'id' => $grade->id,
            'student' => $grade->student?->name,
            'course' => $grade->course?->course_name,
            'semester' => $grade->semester?->name,
            'credit_hours' => $grade->course?->no_of_hours,
            'marks' => $grade->marks,
            'max_marks' => $grade->max_marks,
            'percentage' => $percentage,
            'gpa_points' => $gradeRow['gpa_points'],
            'letter_grade' => $gradeRow['letter_grade'],
            'created_at' => $grade->created_at,
            'updated_at' => $grade->updated_at,
            'deleted_at' => $grade->deleted_at,
        ];
    }
}