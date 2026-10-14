<?php

namespace App\Services;

use App\Models\Grade;
use App\Models\GradeComponentScore;
use App\Models\User;
use App\Support\ActivityLogger;
use App\Support\Settings;
use App\Traits\Notifiable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Owns the grade lifecycle (P2) and component-based score computation (S5).
 *
 * Grades move draft → published → locked. A professor may edit a published
 * grade only inside the configurable edit window and must supply a reason; once
 * the window closes or the grade is locked only an admin may change it. Every
 * transition and override is audit-logged, and a change to an already-visible
 * grade raises a high-signal admin notification (Stage 2 hook).
 */
class GradeService
{
    use Notifiable;

    /**
     * Whether the grade may still be edited by its owning professor.
     */
    public function withinEditWindow(Grade $grade): bool
    {
        if ($grade->isDraft()) {
            return true;
        }

        $base = $grade->published_at ?? $grade->updated_at ?? $grade->created_at;

        if (! $base) {
            return true;
        }

        return now()->lte($base->copy()->addHours(Settings::gradeEditWindowHours()));
    }

    public function publish(Grade $grade, ?Model $actor = null): Grade
    {
        if ($grade->isLocked()) {
            return $grade;
        }

        $republished = $grade->isPublished();

        $grade->forceFill([
            'status' => Grade::STATUS_PUBLISHED,
            'published_at' => $grade->published_at ?? now(),
            'published_by_type' => $actor?->getMorphClass(),
            'published_by_id' => $actor?->getKey(),
        ])->save();

        ActivityLogger::log(
            ActivityLogger::GRADE_PUBLISHED,
            $grade,
            [
                'student_id' => $grade->student_id,
                'course_id' => $grade->course_id,
                'marks' => (float) $grade->marks,
                'max_marks' => (float) $grade->max_marks,
                'republished' => $republished,
            ],
            $actor,
            $republished ? 'Grade re-published.' : 'Grade published.'
        );

        $this->notifyStudentPublished($grade, $actor);

        return $grade;
    }

    public function lock(Grade $grade, ?Model $actor = null): Grade
    {
        $grade->forceFill([
            'status' => Grade::STATUS_LOCKED,
            'locked_at' => now(),
            'locked_by_type' => $actor?->getMorphClass(),
            'locked_by_id' => $actor?->getKey(),
        ])->save();

        ActivityLogger::log(
            ActivityLogger::GRADE_LOCKED,
            $grade,
            ['student_id' => $grade->student_id, 'course_id' => $grade->course_id],
            $actor,
            'Grade locked.'
        );

        return $grade;
    }

    public function unlock(Grade $grade, ?Model $actor = null): Grade
    {
        $grade->forceFill([
            'status' => Grade::STATUS_PUBLISHED,
            'locked_at' => null,
            'locked_by_type' => null,
            'locked_by_id' => null,
        ])->save();

        ActivityLogger::log(
            ActivityLogger::GRADE_UNLOCKED,
            $grade,
            ['student_id' => $grade->student_id, 'course_id' => $grade->course_id],
            $actor,
            'Grade unlocked.'
        );

        return $grade;
    }

    /**
     * Admin override: change marks (and optionally status) with a required
     * reason. If the grade was already visible to the student, a high-signal
     * admin notification is raised.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function override(Grade $grade, array $attributes, string $reason, ?Model $actor = null): Grade
    {
        $wasVisible = $grade->isVisibleToStudent();

        $before = [
            'marks' => (float) $grade->marks,
            'max_marks' => (float) $grade->max_marks,
            'status' => $grade->status,
        ];

        $grade->fill($attributes);
        $grade->edit_reason = $reason;
        $grade->save();

        ActivityLogger::log(
            ActivityLogger::GRADE_OVERRIDDEN,
            $grade,
            [
                'student_id' => $grade->student_id,
                'course_id' => $grade->course_id,
                'before' => $before,
                'after' => [
                    'marks' => (float) $grade->marks,
                    'max_marks' => (float) $grade->max_marks,
                    'status' => $grade->status,
                ],
                'reason' => $reason,
            ],
            $actor,
            'Grade overridden after publication.'
        );

        if ($wasVisible) {
            $this->notifyAllAdmins(
                'Grade changed after publication',
                'Grade #' . $grade->id . ' for "' . ($grade->course?->course_name ?? 'course')
                    . '" was changed after being published.'
            );
        }

        return $grade;
    }

    /**
     * Persist component scores for a grade and recompute its final marks.
     *
     * @param  array<int, array<string, mixed>>  $scores
     */
    public function saveComponentScores(Grade $grade, array $scores): Grade
    {
        $validIds = $grade->course?->gradeComponents()->pluck('id')->all() ?? [];

        DB::transaction(function () use ($grade, $scores, $validIds) {
            foreach ($scores as $score) {
                $componentId = (int) ($score['grade_component_id'] ?? 0);

                if (! in_array($componentId, $validIds, true)) {
                    continue;
                }

                GradeComponentScore::updateOrCreate(
                    ['grade_id' => $grade->id, 'grade_component_id' => $componentId],
                    [
                        'marks' => $score['marks'] ?? 0,
                        'max_marks' => $score['max_marks'] ?? 100,
                    ]
                );
            }
        });

        return $this->recomputeFromComponents($grade);
    }

    /**
     * Recompute the grade's marks from its component scores when the course has
     * components configured. Courses without components keep their manual marks.
     */
    public function recomputeFromComponents(Grade $grade): Grade
    {
        $components = $grade->course?->gradeComponents()->get() ?? collect();

        if ($components->isEmpty()) {
            return $grade;
        }

        $scores = $grade->componentScores()->get()->keyBy('grade_component_id');

        $weightedPercentage = 0.0;

        foreach ($components as $component) {
            $score = $scores->get($component->id);
            $percentage = $score ? $score->percentage() : 0.0;

            $weightedPercentage += $percentage * ((float) $component->weight / 100);
        }

        $max = (float) $grade->max_marks ?: 100.0;

        $grade->forceFill(['marks' => round($weightedPercentage * $max / 100, 2)])->save();

        return $grade;
    }

    protected function notifyStudentPublished(Grade $grade, ?Model $actor): void
    {
        $this->notifyStudent(
            (int) $grade->student_id,
            'Grade published',
            'Your grade for "' . ($grade->course?->course_name ?? 'a course') . '" is now available.',
            $actor instanceof User ? (int) $actor->getKey() : null
        );
    }
}
