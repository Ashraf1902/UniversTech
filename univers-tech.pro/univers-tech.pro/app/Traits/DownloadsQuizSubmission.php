<?php

namespace App\Traits;

use App\Models\QuizSubmission;
use Illuminate\Support\Facades\Storage;

/**
 * Streams a confidential quiz-submission file from the private disk.
 *
 * The policy decides who may ask; this trait only makes sure the stored path
 * cannot escape the quiz-submissions directory and that the response can
 * never be cached or MIME-sniffed by a browser.
 */
trait DownloadsQuizSubmission
{
    protected function downloadQuizSubmission(QuizSubmission $submission)
    {
        $path = (string) $submission->file;

        if (! $this->isSafeSubmissionPath($path) || ! Storage::disk('private')->exists($path)) {
            return SendResponse(404, 'File not found.');
        }

        return Storage::disk('private')->download($path, $submission->downloadName(), [
            'Content-Type' => Storage::disk('private')->mimeType($path) ?: 'application/octet-stream',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store, max-age=0',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }

    protected function isSafeSubmissionPath(string $path): bool
    {
        return $path !== ''
            && ! str_contains($path, "\0")
            && ! str_contains($path, '\\')
            && ! str_starts_with($path, '/')
            && str_starts_with($path, 'quiz-submissions/')
            && ! in_array('..', explode('/', $path), true);
    }
}
