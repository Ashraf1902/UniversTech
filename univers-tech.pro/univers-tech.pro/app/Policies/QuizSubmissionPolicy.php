<?php

namespace App\Policies;

use App\Models\Admin;
use App\Models\QuizSubmission;
use App\Models\User;

class QuizSubmissionPolicy
{
    /**
     * Only the student who owns the submission, the professor assigned to the
     * quiz's course, or an admin with the courses/grades scope may download
     * the file. Every other authenticated user is denied.
     */
    public function download($user, QuizSubmission $submission): bool
    {
        if ($user instanceof Admin) {
            return $user->isSuperAdmin()
                || $user->hasRole('courses')
                || $user->hasRole('grades');
        }

        if (! $user instanceof User) {
            return false;
        }

        if ($user->isStudent()) {
            return (int) $submission->student_id === (int) $user->id;
        }

        if ($user->isProfessor()) {
            $submission->loadMissing('quiz.course');

            return $submission->quiz?->course?->professor_id === $user->id;
        }

        return false;
    }
}
