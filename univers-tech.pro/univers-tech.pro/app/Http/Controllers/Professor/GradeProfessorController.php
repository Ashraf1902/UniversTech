<?php

namespace App\Http\Controllers\Professor;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Grade;
use App\Models\GradeAppeal;
use App\Models\Semester;
use App\Models\StudentCourse;
use App\Services\GradeService;
use App\Support\ActivityLogger;
use App\Traits\AuthorizesCourseOwnership;
use App\Traits\Notifiable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GradeProfessorController extends Controller
{
    use AuthorizesCourseOwnership, Notifiable;

    public function __construct(private GradeService $grades)
    {
    }

    public function store(Request $request)
    {
        $course = Course::find($request->course_id);

        if ($blocked = $this->authorizeCourseOwnership($request, $course, 'You are only allowed to add grades for your own courses.')) {
            return $blocked;
        }

        $data = $request->validate([
            'student_id' => 'required|exists:users,id',
            'course_id' => 'required|exists:courses,id',
            'semester_id' => 'nullable|exists:semesters,id',
            'marks' => 'required_without:component_scores|nullable|numeric|min:0',
            'max_marks' => 'required|numeric|gt:0',
            'reason' => 'nullable|string|max:1000',
            'component_scores' => 'nullable|array',
            'component_scores.*.grade_component_id' => 'required|integer',
            'component_scores.*.marks' => 'required|numeric|min:0',
            'component_scores.*.max_marks' => 'nullable|numeric|gt:0',
        ]);

        if (! empty($data['component_scores'])) {
            $data['marks'] = $data['marks'] ?? 0;
        } elseif ($data['marks'] > $data['max_marks']) {
            return SendResponse(422, 'The marks may not be greater than the maximum marks.');
        }

        $isEnrolled = StudentCourse::where('student_id', $data['student_id'])
            ->where('course_id', $course->id)
            ->registered()
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
            if ($grade->isLocked()) {
                return SendResponse(403, 'This grade is locked. Only an admin can change it.');
            }

            if ($grade->isPublished() && ! $this->grades->withinEditWindow($grade)) {
                return SendResponse(403, 'The edit window for this published grade has closed. Only an admin can change it.');
            }

            if ($grade->isPublished() && blank($data['reason'] ?? null)) {
                return SendResponse(422, 'A reason is required when editing a published grade.');
            }

            $grade->restore();
            $grade->fill([
                'marks' => $data['marks'] ?? $grade->marks,
                'max_marks' => $data['max_marks'],
                'semester_id' => $data['semester_id'],
                'edit_reason' => $data['reason'] ?? $grade->edit_reason,
            ])->save();
        } else {
            $grade = Grade::create([
                'student_id' => $data['student_id'],
                'course_id' => $course->id,
                'semester_id' => $data['semester_id'],
                'marks' => $data['marks'] ?? 0,
                'max_marks' => $data['max_marks'],
                'status' => Grade::STATUS_DRAFT,
            ]);
        }

        if (! empty($data['component_scores'])) {
            $grade = $this->grades->saveComponentScores($grade, $data['component_scores']);
        } else {
            $grade = $this->grades->recomputeFromComponents($grade);
        }

        return SendResponse(200, 'Grade saved as a draft successfully.', $this->formatGrade($grade->load(['student', 'course', 'semester'])));
    }

    public function index(Request $request)
    {
        $request->validate([
            'course_id' => 'required|exists:courses,id',
            'semester_id' => 'nullable|exists:semesters,id',
            'status' => 'nullable|in:draft,published,locked',
        ]);

        $course = Course::find($request->course_id);

        if ($blocked = $this->authorizeCourseOwnership($request, $course, 'You are not allowed to view grades for this course.')) {
            return $blocked;
        }

        $grades = Grade::where('course_id', $course->id)
            ->when($request->filled('semester_id'), fn ($q) => $q->where('semester_id', $request->semester_id))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->with(['student', 'course', 'semester', 'componentScores'])
            ->orderByDesc('created_at')
            ->paginate(15)
            ->through(fn (Grade $grade) => $this->formatGrade($grade));

        return SendResponse(200, 'Grades fetched successfully.', $grades);
    }

    public function publish(Request $request)
    {
        $data = $request->validate([
            'grade_id' => 'nullable|exists:grades,id',
            'course_id' => 'nullable|exists:courses,id',
            'semester_id' => 'nullable|exists:semesters,id',
        ]);

        if ($request->filled('grade_id')) {
            $grade = Grade::with('course')->findOrFail($data['grade_id']);

            if ($blocked = $this->authorizeCourseOwnership($request, $grade->course, 'You are not allowed to publish this grade.')) {
                return $blocked;
            }

            if ($grade->isLocked()) {
                return SendResponse(422, 'This grade is locked.');
            }

            if ($grade->isPublished()) {
                return SendResponse(422, 'This grade is already published.');
            }

            $this->grades->publish($grade, $request->user());

            return SendResponse(200, 'Grade published successfully.', $this->formatGrade($grade->load(['student', 'course', 'semester'])));
        }

        $request->validate(['course_id' => 'required|exists:courses,id']);

        $course = Course::findOrFail($data['course_id']);

        if ($blocked = $this->authorizeCourseOwnership($request, $course, 'You are not allowed to publish grades for this course.')) {
            return $blocked;
        }

        $grades = Grade::where('course_id', $course->id)
            ->where('status', Grade::STATUS_DRAFT)
            ->when($request->filled('semester_id'), fn ($q) => $q->where('semester_id', $request->semester_id))
            ->get();

        foreach ($grades as $grade) {
            $this->grades->publish($grade, $request->user());
        }

        return SendResponse(200, $grades->count() . ' grades published successfully.', ['published' => $grades->count()]);
    }

    public function delete(Request $request, $id)
    {
        $grade = Grade::with('course')->find($id);

        if (! $grade) {
            return SendResponse(404, 'Grade not found.');
        }

        if ($blocked = $this->authorizeCourseOwnership($request, $grade->course, 'You are not allowed to delete this grade.')) {
            return $blocked;
        }

        if (! $grade->isDraft()) {
            return SendResponse(403, 'Published or locked grades can only be archived by an admin.');
        }

        $grade->delete();

        return SendResponse(200, 'Draft grade archived.');
    }

    public function components(Request $request)
    {
        $request->validate([
            'course_id' => 'required|exists:courses,id',
        ]);

        $course = Course::find($request->course_id);

        if ($blocked = $this->authorizeCourseOwnership($request, $course, 'You are not allowed to view this course.')) {
            return $blocked;
        }

        return SendResponse(200, 'Components fetched successfully.', $this->componentList($course));
    }

    public function syncComponents(Request $request)
    {
        $data = $request->validate([
            'course_id' => 'required|exists:courses,id',
            'components' => 'present|array',
            'components.*.name' => 'required|string|max:100',
            'components.*.weight' => 'required|numeric|min:0|max:100',
            'components.*.position' => 'nullable|integer|min:0',
        ]);

        $course = Course::findOrFail($data['course_id']);

        if ($blocked = $this->authorizeCourseOwnership($request, $course, 'You are not allowed to configure this course.')) {
            return $blocked;
        }

        $components = $data['components'];

        if (! empty($components)) {
            $total = array_sum(array_map(fn ($c) => (float) $c['weight'], $components));

            if (abs($total - 100) > 0.01) {
                return SendResponse(422, 'Component weights must total 100.', [
                    'errors' => ['components' => ['Component weights must total 100.']],
                ]);
            }
        }

        DB::transaction(function () use ($course, $components) {
            $course->gradeComponents()->delete();

            foreach (array_values($components) as $index => $component) {
                $course->gradeComponents()->create([
                    'name' => $component['name'],
                    'weight' => $component['weight'],
                    'position' => $component['position'] ?? $index,
                ]);
            }
        });

        ActivityLogger::log(
            ActivityLogger::GRADE_COMPONENTS_UPDATED,
            $course,
            ['components' => $components],
            $request->user(),
            'Grade components updated.'
        );

        return SendResponse(200, 'Components saved successfully.', $this->componentList($course));
    }

    public function appeals(Request $request)
    {
        $request->validate([
            'course_id' => 'nullable|exists:courses,id',
            'status' => 'nullable|in:pending,accepted,rejected',
        ]);

        $professorId = $request->user()->id;

        $appeals = GradeAppeal::query()
            ->whereHas('grade.course', fn ($q) => $q->where('professor_id', $professorId))
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

        if ($blocked = $this->authorizeCourseOwnership($request, $appeal->grade?->course, 'You are not allowed to respond to this appeal.')) {
            return $blocked;
        }

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
            (int) $request->user()->id
        );

        return SendResponse(200, 'Appeal answered successfully.', $this->formatAppeal($appeal->load(['grade.course', 'student'])));
    }

    private function componentList(Course $course): array
    {
        return $course->gradeComponents()->get()->map(fn ($component) => [
            'id' => $component->id,
            'name' => $component->name,
            'weight' => (float) $component->weight,
            'position' => $component->position,
        ])->all();
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
            'course' => $appeal->grade?->course?->course_name,
            'course_id' => $appeal->grade?->course_id,
            'marks' => $appeal->grade?->marks,
            'max_marks' => $appeal->grade?->max_marks,
        ];
    }

    private function formatGrade(Grade $grade): array
    {
        $percentage = $grade->max_marks > 0 ? round($grade->marks / $grade->max_marks * 100, 2) : 0;

        return [
            'id' => $grade->id,
            'student' => $grade->student?->name,
            'student_id' => $grade->student_id,
            'course' => $grade->course?->course_name,
            'course_id' => $grade->course_id,
            'semester' => $grade->semester?->name,
            'semester_id' => $grade->semester_id,
            'marks' => $grade->marks,
            'max_marks' => $grade->max_marks,
            'percentage' => $percentage,
            'rate' => Grade::percentageToGpa($percentage)['letter_grade'],
            'status' => $grade->status,
            'published_at' => $grade->published_at,
            'locked_at' => $grade->locked_at,
            'edit_reason' => $grade->edit_reason,
            'can_edit' => ! $grade->isLocked() && (! $grade->isPublished() || $this->grades->withinEditWindow($grade)),
            'can_delete' => $grade->isDraft(),
            'updated_at' => $grade->updated_at,
            'component_scores' => $grade->relationLoaded('componentScores')
                ? $grade->componentScores->map(fn ($score) => [
                    'grade_component_id' => $score->grade_component_id,
                    'marks' => (float) $score->marks,
                    'max_marks' => (float) $score->max_marks,
                ])->all()
                : null,
        ];
    }
}
