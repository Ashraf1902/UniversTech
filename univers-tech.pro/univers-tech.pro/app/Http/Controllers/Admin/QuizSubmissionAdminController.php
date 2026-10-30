<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\QuizSubmission;
use App\Traits\DownloadsQuizSubmission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class QuizSubmissionAdminController extends Controller
{
    use DownloadsQuizSubmission;

    /**
     * Stream a submission for admins with the courses or grades scope.
     * The route middleware narrows the scope; the policy is the final check.
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
}
