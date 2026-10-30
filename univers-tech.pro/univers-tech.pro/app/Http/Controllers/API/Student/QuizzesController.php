<?php

namespace App\Http\Controllers\API\Student;

use App\Http\Controllers\Controller;
use App\Http\Requests\Student\StudentSubmitQuizRequest;
use App\Models\Quiz;
use App\Models\QuizSubmission;
use App\Models\StudentCourse;
use App\Support\ActivityLogger;
use App\Support\Settings;
use App\Traits\DownloadsQuizSubmission;
use App\Traits\Notifiable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class QuizzesController extends Controller
{
    use Notifiable, DownloadsQuizSubmission;

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
            ? $this->storeSubmissionFile($request, $quiz)
            : null;

        $submission = DB::transaction(function () use ($quiz, $existing, $file, $request) {
            if ($existing) {
                $attributes = [
                    'answer_text' => $request->input('answer_text'),
                    'submitted_at' => now(),
                ];

                if ($file) {
                    $this->deleteSubmissionFile($existing->file);
                    $attributes['file'] = $file['file'];
                    $attributes['original_name'] = $file['original_name'];
                }

                $existing->update($attributes);

                return $existing;
            }

            return QuizSubmission::create([
                'quiz_id' => $quiz->id,
                'student_id' => auth()->id(),
                'file' => $file['file'] ?? null,
                'original_name' => $file['original_name'] ?? null,
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
            'download_url' => $submission->file
                ? route('student.quiz-submissions.download', ['id' => $submission->id], false)
                : null,
            'original_name' => $submission->original_name,
            'answer_text' => $submission->answer_text,
            'submitted_at' => $submission->submitted_at,
            'score' => $submission->score,
            'feedback' => $submission->feedback,
            'graded_at' => $submission->graded_at,
        ];
    }

    /**
     * Stream the authenticated student's own submission from the private disk.
     */
    public function download(Request $request, $id)
    {
        $submission = QuizSubmission::with('quiz.course')->find($id);

        if (! $submission) {
            return SendResponse(404, 'Submission not found.');
        }

        if (! Gate::forUser($request->user())->allows('download', $submission)) {
            return SendResponse(403, 'You are not allowed to download this file.');
        }

        return $this->downloadQuizSubmission($submission);
    }

    /**
     * Store the upload on the private disk under a server-generated name.
     *
     * @return array{file: string, original_name: string}
     */
    private function storeSubmissionFile(Request $request, Quiz $quiz): array
    {
        $file = $request->file('file');

        $extension = strtolower($file->extension() ?: $file->getClientOriginalExtension());
        $allowed = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];

        if (! in_array($extension, $allowed, true)) {
            abort(422, 'The file type is not allowed.');
        }

        $path = $file->storeAs(
            'quiz-submissions/' . $quiz->id,
            Str::uuid()->toString() . '.' . $extension,
            'private'
        );

        $original = basename(str_replace('\\', '/', $file->getClientOriginalName()));

        return [
            'file' => $path,
            'original_name' => mb_substr($original !== '' ? $original : 'submission.' . $extension, 0, 255),
        ];
    }

    /**
     * Remove a replaced submission from both the private disk and the legacy
     * public location (files already moved by files:move-private only exist on
     * the private disk).
     */
    private function deleteSubmissionFile(?string $path): void
    {
        if (! $path) {
            return;
        }

        Storage::disk('private')->delete($path);
        Storage::disk('files')->delete($path);
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
