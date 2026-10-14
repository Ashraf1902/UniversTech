<?php

namespace App\Policies;

use App\Models\Course;
use App\Models\User;

class CoursePolicy
{
    /**
     * Determine whether the given professor is the assigned professor
     * of the course. This is the single source of truth for the
     * "course.owned" rule used by every professor-facing endpoint.
     */
    public function manage(User $user, Course $course): bool
    {
        return $user->isProfessor() && $course->professor_id === $user->id;
    }
}
