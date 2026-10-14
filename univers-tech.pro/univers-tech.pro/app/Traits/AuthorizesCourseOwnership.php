<?php

namespace App\Traits;

use App\Models\Course;
use App\Models\Grade;
use App\Models\Lecture;
use App\Models\Quiz;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Centralized professor course-ownership authorization.
 *
 * The rule itself lives in App\Policies\CoursePolicy (ability: "manage").
 * This trait only resolves a related resource (lecture / quiz / grade) back
 * to its course and enforces the policy, returning the standard 403 envelope
 * so callers can simply `return` the result.
 */
trait AuthorizesCourseOwnership
{
    protected function courseFromLecture(?int $lectureId): ?Course
    {
        return $lectureId ? Lecture::with('course')->find($lectureId)?->course : null;
    }

    protected function courseFromQuiz(?int $quizId): ?Course
    {
        return $quizId ? Quiz::with('course')->find($quizId)?->course : null;
    }

    protected function courseFromGrade(?int $gradeId): ?Course
    {
        return $gradeId ? Grade::with('course')->find($gradeId)?->course : null;
    }

    /**
     * Returns a 403 response when the authenticated user does not own the
     * course (or the course could not be resolved); null when allowed.
     */
    protected function authorizeCourseOwnership(
        Request $request,
        ?Course $course,
        string $message = 'You are not allowed to access this resource.'
    ): ?JsonResponse {
        if (! $course || ! Gate::forUser($request->user())->allows('manage', $course)) {
            return SendResponse(403, $message);
        }

        return null;
    }
}
