<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Grade;
use App\Models\GradeAppeal;
use App\Models\Semester;
use App\Models\StudentCourse;
use App\Models\User;
use App\Services\GradeService;
use App\Support\ActivityLogger;
use App\Traits\Notifiable;
use Illuminate\Http\Request;

class GradeAdminController extends Controller
{
    use Notifiable;

    public function __construct(private GradeService $grades)
    {
    }

    public function index(Request $request)
    {
        $request->validate([
            'student_id' => 'nullable|exists:users,id',
            'course_id' => 'nullable|exists:courses,id',
            'semester_id' => 'nullable|exists:semesters,id',
            'status' => 'nullable|in:draft,published,locked',
        ]);

        $grades = ($request->boolean('deleted') ? Grade::onlyTrashed() : Grade::query())
            ->with(['student', 'course', 'semester'])
            ->when($request->filled('student_id'), fn ($q) => $q->where('student_id', $request->student_id))
            ->when($request->filled('course_id'), fn ($q) => $q->where('course_id', $request->course_id))
            ->when($request->filled('semester_id'), fn ($q) => $q->where('semester_id', $request->semester_id))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = $request->search;
                $q->where(function ($qq) use ($term) {
                    $qq->whereHas('student', fn ($s) => $s->where('name', 'like', "%{$term}%")->orWhere('email', 'like', "%{$term}%"))
                        ->orWhereHas('course', fn ($c) => $c->where('course_name', 'like', "%{$term}%")->orWhere('course_code', 'like', "%{$term}%"))
                        ->orWhereHas('semester', fn ($s) => $s->where('name', 'like', "%{$term}%")->orWhere('academic_year', 'like', "%{$term}%"));
                });
            })
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

        return Grade::create(array_merge($data, [
            'status' => Grade::STATUS_PUBLISHED,
            'published_at' => now(),
        ]));
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
            ->where('status', '!=', StudentCourse::STATUS_DROPPED)
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
            'status' => $grade->status,
            'published_at' => $grade->published_at,
            'locked_at' => $grade->locked_at,
            'edit_reason' => $grade->edit_reason,
            'created_at' => $grade->created_at,
            'updated_at' => $grade->updated_at,
            'deleted_at' => $grade->deleted_at,
        ];
    }

    /**
     * Lock a published grade so only an admin can change it (A: grade lifecycle).
     */
    public function lock(Request $request, $id)
    {
        $grade = Grade::with('course')->find($id);

        if (! $grade) {
            return SendResponse(404, 'Grade not found.');
        }

        if ($grade->isDraft()) {
            return SendResponse(422, 'Publish the grade before locking it.');
        }

        $this->grades->lock($grade, $request->user());

        return SendResponse(200, 'Grade locked successfully.', $this->formatGrade($grade->load(['student', 'course', 'semester'])));
    }

    public function unlock(Request $request, $id)
    {
        $grade = Grade::with('course')->find($id);

        if (! $grade) {
            return SendResponse(404, 'Grade not found.');
        }

        $this->grades->unlock($grade, $request->user());

        return SendResponse(200, 'Grade unlocked successfully.', $this->formatGrade($grade->load(['student', 'course', 'semester'])));
    }

    /**
     * Override grade marks (any state) with a mandatory reason.
     */
    public function override(Request $request)
    {
        $data = $request->validate([
            'grade_id' => 'required|exists:grades,id',
            'marks' => 'required|numeric|min:0',
            'max_marks' => 'required|numeric|gt:0',
            'reason' => 'required|string|max:2000',
        ]);

        if ($data['marks'] > $data['max_marks']) {
            return SendResponse(422, 'The marks may not be greater than the maximum marks.');
        }

        $grade = Grade::with('course')->findOrFail($data['grade_id']);

        $grade = $this->grades->override($grade, [
            'marks' => $data['marks'],
            'max_marks' => $data['max_marks'],
        ], $data['reason'], $request->user());

        return SendResponse(200, 'Grade overridden successfully.', $this->formatGrade($grade->load(['student', 'course', 'semester'])));
    }

    /**
     * Appeals raised by students across all courses.
     */
    public function appeals(Request $request)
    {
        $request->validate([
            'course_id' => 'nullable|exists:courses,id',
            'status' => 'nullable|in:pending,accepted,rejected',
        ]);

        $appeals = GradeAppeal::query()
            ->when($request->filled('course_id'), fn ($q) => $q->whereHas('grade', fn ($g) => $g->where('course_id', $request->course_id)))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->with(['grade.course', 'grade.semester', 'student'])
            ->orderByDesc('created_at')
            ->paginate(15)
            ->through(fn (GradeAppeal $appeal) => $this->formatAppeal($appeal));

        return SendResponse(200, 'Appeals fetched successfully.', $appeals);
    }

    public function respondAppeal(Request $request)
    {
        $data = $request->validate([
            'appeal_id' => 'required|exists:grade_appeals,id',
            'action' => 'required|in:accept,reject',
            'note' => 'required|string|max:2000',
        ]);

        $appeal = GradeAppeal::with('grade.course')->findOrFail($data['appeal_id']);

        if (! $appeal->isPending()) {
            return SendResponse(422, 'This appeal has already been answered.');
        }

        $status = $data['action'] === 'accept' ? GradeAppeal::STATUS_ACCEPTED : GradeAppeal::STATUS_REJECTED;

        $appeal->forceFill([
            'status' => $status,
            'response_note' => $data['note'],
            'responded_by_type' => $request->user()->getMorphClass(),
            'responded_by_id' => $request->user()->id,
            'responded_at' => now(),
        ])->save();

        ActivityLogger::log(
            ActivityLogger::GRADE_APPEAL_RESOLVED,
            $appeal,
            ['status' => $status, 'reason' => $data['note']],
            $request->user(),
            'Grade appeal ' . $status . '.'
        );

        $this->notifyStudent(
            (int) $appeal->student_id,
            'Grade appeal ' . $status,
            'Your appeal for "' . ($appeal->grade?->course?->course_name ?? 'a course') . '" was ' . $status . '.',
            null
        );

        return SendResponse(200, 'Appeal answered successfully.', $this->formatAppeal($appeal->load(['grade.course', 'student'])));
    }

    private function formatAppeal(GradeAppeal $appeal): array
    {
        return [
            'id' => $appeal->id,
            'status' => $appeal->status,
            'reason' => $appeal->reason,
            'response_note' => $appeal->response_note,
            'responded_at' => $appeal->responded_at,
            'created_at' => $appeal->created_at,
            'student' => $appeal->student?->name,
            'student_id' => $appeal->student_id,
            'course' => $appeal->grade?->course?->course_name,
            'course_id' => $appeal->grade?->course_id,
            'marks' => $appeal->grade?->marks,
            'max_marks' => $appeal->grade?->max_marks,
        ];
    }
}