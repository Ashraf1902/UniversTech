<?php

namespace App\Http\Controllers\API\Student;

use App\Http\Controllers\Controller;
use App\Models\Grade;
use App\Models\GradeAppeal;
use App\Support\ActivityLogger;
use App\Support\Settings;
use App\Traits\Notifiable;
use Illuminate\Http\Request;

/**
 * Student grade appeals (S5): a student may challenge a published grade inside
 * the configurable appeal window.
 */
class AppealController extends Controller
{
    use Notifiable;

    public function index()
    {
        $appeals = GradeAppeal::where('student_id', auth()->id())
            ->with(['grade.course'])
            ->orderByDesc('created_at')
            ->paginate(15)
            ->through(fn (GradeAppeal $appeal) => $this->formatAppeal($appeal));

        return SendResponse(200, 'Appeals fetched successfully.', $appeals);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'grade_id' => 'required|exists:grades,id',
            'reason' => 'required|string|max:2000',
        ]);

        $grade = Grade::with('course')
            ->where('student_id', auth()->id())
            ->visible()
            ->find($data['grade_id']);

        if (! $grade) {
            return SendResponse(404, 'Grade not found.');
        }

        $base = $grade->published_at ?? $grade->created_at;

        if ($base && now()->gt($base->copy()->addDays(Settings::appealWindowDays()))) {
            return SendResponse(422, 'The appeal window for this grade has closed.');
        }

        $pending = GradeAppeal::where('grade_id', $grade->id)
            ->where('student_id', auth()->id())
            ->where('status', GradeAppeal::STATUS_PENDING)
            ->exists();

        if ($pending) {
            return SendResponse(422, 'You already have a pending appeal for this grade.');
        }

        $appeal = GradeAppeal::create([
            'grade_id' => $grade->id,
            'student_id' => auth()->id(),
            'reason' => $data['reason'],
            'status' => GradeAppeal::STATUS_PENDING,
        ]);

        ActivityLogger::log(
            ActivityLogger::GRADE_APPEAL_SUBMITTED,
            $appeal,
            ['grade_id' => $grade->id, 'course_id' => $grade->course_id],
            auth()->user(),
            'Grade appeal submitted.'
        );

        $content = auth()->user()->name . ' appealed their grade for "'
            . ($grade->course?->course_name ?? 'a course') . '".';

        $this->notifyProfessor($grade->course?->professor_id, 'New grade appeal', $content, auth()->id());
        $this->notifyAllAdmins('New grade appeal', $content);

        return SendResponse(200, 'Appeal submitted successfully.', $this->formatAppeal($appeal->load('grade.course')));
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
            'course' => $appeal->grade?->course?->course_name,
            'course_id' => $appeal->grade?->course_id,
            'marks' => $appeal->grade?->marks,
            'max_marks' => $appeal->grade?->max_marks,
        ];
    }
}
