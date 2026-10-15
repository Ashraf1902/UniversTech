<?php

namespace App\Http\Controllers\API\Student;

use App\Http\Controllers\Controller;
use App\Http\Requests\Student\StudentSubmitQuizRequest;
use App\Models\Quiz;
use App\Models\QuizSubmission;
use App\Models\StudentCourse;
use App\Support\ActivityLogger;
use App\Support\Settings;
use App\Traits\File\UpdateFile;
use App\Traits\Notifiable;
use Illuminate\Support\Facades\DB;

class QuizzesController extends Controller
{
    use Notifiable, UpdateFile;

    /**
     * All published quizzes of the courses the student is registered in,
     * each annotated with the student's own submission status.
     */
    public function index()
    {
        $courseIds = StudentCourse::where('student_id', auth()->id())
            ->registered()
            ->pluck('course_id');

        $quizzes = Quiz::whereIn('course_id', $courseIds)
            ->whereNotNull('published_at')
            ->with('course:id,course_name,course_code')
            ->orderByDesc('created_at')
            ->paginate(15);

        $ids = collect($quizzes->items())->pluck('id');

        $submissions = QuizSubmission::where('student_id', auth()->id())
            ->whereIn('quiz_id', $ids)
            ->get()
            ->keyBy('quiz_id');

        $quizzes->setCollection(
            $quizzes->getCollection()->map(
                fn (Quiz $quiz) => $this->formatQuiz($quiz, $submissions->get($quiz->id))
            )
        );

        return SendResponse(200, 'Quizzes fetched successfully.', $quizzes);
    }

    /**
     * A single quiz the student is registered for.
     */
    public function show($id)
    {
        $quiz = $this->registeredQuiz($id);

        if (! $quiz) {
            return SendResponse(404, 'Quiz not found.');
        }

        $submission = QuizSubmission::where('quiz_id', $quiz->id)
            ->where('student_id', auth()->id())
            ->first();

        return SendResponse(200, 'Quiz fetched successfully.', $this->formatQuiz($quiz, $submission));
    }

    /**
     * Submit (or, when enabled, resubmit) an answer for a quiz.
     */
    public function submit(StudentSubmitQuizRequest $request, $id)
    {
        $quiz = $this->registeredQuiz($id);

        if (! $quiz) {
            return SendResponse(404, 'Quiz not found.');
        }

        $existing = QuizSubmission::where('quiz_id', $quiz->id)
            ->where('student_id', auth()->id())
            ->first();

        if ($existing && ! Settings::quizAllowResubmit()) {
            return SendResponse(422, 'You have already submitted this quiz.');
        }

        if (! Settings::quizAllowLate() && $quiz->isPastDue()) {
            return SendResponse(422, 'The deadline for this quiz has passed.');
        }

        $file = $request->hasFile('file')
            ? $this->uploadFile($request, 'file', 'quiz_submissions')
            : null;

        $submission = DB::transaction(function () use ($quiz, $existing, $file, $request) {
            if ($existing) {
                $attributes = [
                    'answer_text' => $request->input('answer_text'),
                    'submitted_at' => now(),
                ];

                if ($file) {
                    if ($existing->file) {
                        $this->deleteFile($existing->file);
                    }
                    $attributes['file'] = $file;
                }

                $existing->update($attributes);

                return $existing;
            }

            return QuizSubmission::create([
                'quiz_id' => $quiz->id,
                'student_id' => auth()->id(),
                'file' => $file,
                'answer_text' => $request->input('answer_text'),
                'submitted_at' => now(),
            ]);
        });

        ActivityLogger::log(
            ActivityLogger::QUIZ_SUBMISSION_SUBMITTED,
            $submission,
            [
                'quiz_id' => $quiz->id,
                'course_id' => $quiz->course_id,
                'student_id' => auth()->id(),
            ],
            null,
            'Quiz "' . $quiz->name . '" submitted.'
        );

        $this->notifyProfessor(
            $quiz->course->professor_id,
            'New quiz submission',
            auth()->user()->name . ' submitted "' . $quiz->name . '".',
            auth()->id()
        );

        return SendResponse(200, 'Quiz submitted successfully.', [
            'submission' => $this->formatSubmission($submission),
        ]);
    }

    /**
     * Resolve a published quiz only when the student has a registered
     * enrollment in its course.
     */
    private function registeredQuiz($id): ?Quiz
    {
        $quiz = Quiz::with('course')->whereNotNull('published_at')->find($id);

        if (! $quiz) {
            return null;
        }

        $enrolled = StudentCourse::where('student_id', auth()->id())
            ->where('course_id', $quiz->course_id)
            ->registered()
            ->exists();

        return $enrolled ? $quiz : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function formatQuiz(Quiz $quiz, ?QuizSubmission $submission): array
    {
        $state = $this->submissionState($quiz, $submission);

        return [
            'id' => $quiz->id,
            'name' => $quiz->name,
            'content' => url('uploads/' . $quiz->content),
            'due_at' => $quiz->due_at,
            'max_score' => $quiz->max_score,
            'course' => $quiz->course ? [
                'id' => $quiz->course->id,
                'course_name' => $quiz->course->course_name,
                'course_code' => $quiz->course->course_code,
            ] : null,
            'status' => $state['status'],
            'can_submit' => $state['allowed'],
            'blocked_reason' => $state['reason'],
            'submission' => $submission ? $this->formatSubmission($submission) : null,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function formatSubmission(QuizSubmission $submission): array
    {
        return [
            'id' => $submission->id,
            'file' => $submission->file ? url('uploads/' . $submission->file) : null,
            'answer_text' => $submission->answer_text,
            'submitted_at' => $submission->submitted_at,
            'score' => $submission->score,
            'feedback' => $submission->feedback,
            'graded_at' => $submission->graded_at,
        ];
    }

    /**
     * @return array{status: string, allowed: bool, reason: ?string}
     */
    private function submissionState(Quiz $quiz, ?QuizSubmission $submission): array
    {
        $status = 'not_submitted';
        if ($submission) {
            $status = $submission->isGraded() ? 'graded' : 'submitted';
        }

        if ($submission && ! Settings::quizAllowResubmit()) {
            return ['status' => $status, 'allowed' => false, 'reason' => 'already_submitted'];
        }

        if (! Settings::quizAllowLate() && $quiz->isPastDue()) {
            return ['status' => $status, 'allowed' => false, 'reason' => 'deadline_passed'];
        }

        return ['status' => $status, 'allowed' => true, 'reason' => null];
    }
}
