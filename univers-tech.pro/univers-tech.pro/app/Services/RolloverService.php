<?php

namespace App\Services;

use App\Models\Grade;
use App\Models\Level;
use App\Models\Semester;
use App\Models\StudentCourse;
use App\Models\StudentPromotion;
use App\Models\User;
use App\Support\ActivityLogger;
use App\Support\Settings;
use App\Traits\Notifiable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class RolloverService
{
    use Notifiable;

    public function __construct(private GradeService $grades)
    {
    }

    public function closeSummary(Semester $semester): array
    {
        $unresolved = $this->unresolvedList($semester);

        $gradesToLock = Grade::where('semester_id', $semester->id)
            ->where('status', Grade::STATUS_PUBLISHED)
            ->count();

        $completed = $this->countResolved($semester, StudentCourse::STATUS_COMPLETED);
        $failed = $this->countResolved($semester, StudentCourse::STATUS_FAILED);

        return [
            'semester_id' => $semester->id,
            'grades_to_lock' => $gradesToLock,
            'enrollments_completed' => $completed,
            'enrollments_failed' => $failed,
            'unresolved_count' => count($unresolved),
            'unresolved' => $unresolved,
        ];
    }

    public function close(Semester $semester, ?Model $actor = null): array
    {
        return DB::transaction(function () use ($semester, $actor) {
            // Capture pre-close counts
            $gradesToLockPre = Grade::where('semester_id', $semester->id)
                ->where('status', Grade::STATUS_PUBLISHED)
                ->count();

            // Lock published grades
            $grades = Grade::where('semester_id', $semester->id)
                ->where('status', Grade::STATUS_PUBLISHED)
                ->get();

            foreach ($grades as $grade) {
                $this->grades->lock($grade, $actor);
            }

            // Resolve registered enrollments
            $enrollments = StudentCourse::whereHas('course', function ($q) use ($semester) {
                $q->where('semester_id', $semester->id);
            })
                ->orWhere('semester_id', $semester->id)
                ->get()
                ->filter(fn (StudentCourse $e) => $e->status === StudentCourse::STATUS_REGISTERED)
                ->values();

            foreach ($enrollments as $enrollment) {
                $grade = Grade::where('student_id', $enrollment->student_id)
                    ->where('course_id', $enrollment->course_id)
                    ->where('semester_id', $semester->id)
                    ->first();

                if ($grade && $grade->isVisibleToStudent()) {
                    $max = (float) $grade->max_marks;
                    $pct = $max > 0 ? ((float) $grade->marks / $max) * 100 : 0;
                    $passing = Settings::passingScore();

                    if ($pct >= $passing) {
                        if ($enrollment->status !== StudentCourse::STATUS_COMPLETED) {
                            $enrollment->changeStatus(StudentCourse::STATUS_COMPLETED, $actor, [
                                'semester_id' => $semester->id,
                                'percentage' => round($pct, 2),
                            ]);
                        }
                        continue;
                    }

                    if ($enrollment->status !== StudentCourse::STATUS_FAILED) {
                        $enrollment->changeStatus(StudentCourse::STATUS_FAILED, $actor, [
                            'semester_id' => $semester->id,
                            'percentage' => round($pct, 2),
                        ]);
                    }
                    continue;
                }

                // No visible grade → leave as registered; unresolved
            }

            $semester->forceFill([
                'is_active' => false,
                'closed_at' => now(),
            ])->save();

            ActivityLogger::log(
                ActivityLogger::SEMESTER_CLOSED,
                $semester,
                $this->closeSummary($semester),
                $actor,
                'Semester closed'
            );

            $summary = $this->closeSummary($semester);
            $summary['grades_locked'] = $grades->count();
            $summary['grades_to_lock'] = $gradesToLockPre;

            return $summary;
        });
    }

    public function unresolvedList(Semester $semester): array
    {
        $items = [];
        $enrollments = StudentCourse::where('status', StudentCourse::STATUS_REGISTERED)
            ->with(['student', 'course'])
            ->get()
            ->filter(function (StudentCourse $e) use ($semester) {
                $sid = $e->semester_id;
                return ($sid && $sid === $semester->id) || ($e->course && $e->course->semester_id === $semester->id);
            })
            ->values();

        foreach ($enrollments as $enrollment) {
            $grade = Grade::where('student_id', $enrollment->student_id)
                ->where('course_id', $enrollment->course_id)
                ->where('semester_id', $semester->id)
                ->first();

            if ($grade && $grade->isVisibleToStudent()) {
                continue; // resolved
            }

            $reason = $grade ? ('grade_' . $grade->status) : 'ungraded';

            $items[] = [
                'enrollment_id' => $enrollment->id,
                'student_id' => $enrollment->student_id,
                'student_name' => $enrollment->student?->name,
                'course_id' => $enrollment->course_id,
                'course_name' => $enrollment->course?->course_name,
                'course_code' => $enrollment->course?->course_code,
                'reason' => $reason,
            ];
        }

        return $items;
    }

    public function previewPromotion(array $options): array
    {
        return $this->buildPromotionList($options, dryRun: true);
    }

    public function applyPromotion(array $options, ?Model $actor = null): array
    {
        return DB::transaction(function () use ($options, $actor) {
            $list = $this->buildPromotionList($options, dryRun: false);

            foreach ($list as $row) {
                if ($row['action'] === 'skipped' || $row['action'] === 'excluded') {
                    continue;
                }

                $studentId = $row['student_id'];
                $fromSemesterId = $options['from_semester_id'] ?? null;

                $promo = StudentPromotion::firstOrCreate([
                    'student_id' => $studentId,
                    'from_semester_id' => $fromSemesterId,
                ], [
                    'from_level_id' => $row['from_level_id'],
                    'to_level_id' => $row['to_level_id'] ?? null,
                    'to_semester_id' => null,
                    'action' => $row['action'],
                    'applied_at' => now(),
                ]);

                // If already existed, treat as skipped (idempotent)
                if (! $promo->wasRecentlyCreated) {
                    continue;
                }

                $user = User::find($studentId);
                if (! $user) {
                    continue;
                }

                if ($row['action'] === StudentPromotion::ACTION_GRADUATED) {
                    $user->forceFill([
                        'status' => User::STATUS_GRADUATED,
                    ])->save();
                    if (method_exists($user, 'revokeTokens')) {
                        $user->revokeTokens();
                    }

                    ActivityLogger::log(
                        ActivityLogger::STUDENT_GRADUATED,
                        $user,
                        ['from_level_id' => $row['from_level_id'], 'from_semester' => $row['from_semester']],
                        $actor,
                        'Student graduated'
                    );
                } else {
                    $updates = [];
                    if ($row['to_level_id']) {
                        $updates['level_id'] = $row['to_level_id'];
                    }
                    if ($row['to_semester']) {
                        $updates['semester'] = $row['to_semester'];
                    }
                    if (! empty($updates)) {
                        $user->forceFill($updates)->save();
                    }

                    if ($user->student) {
                        $sUpdates = [];
                        if ($row['to_level_id']) {
                            $sUpdates['level_id'] = $row['to_level_id'];
                        }
                        if ($row['to_semester']) {
                            $sUpdates['semester'] = $row['to_semester'];
                        }
                        if (! empty($sUpdates)) {
                            $user->student->forceFill($sUpdates)->save();
                        }
                    }

                    ActivityLogger::log(
                        ActivityLogger::STUDENT_PROMOTED,
                        $user,
                        [
                            'from_level_id' => $row['from_level_id'],
                            'to_level_id' => $row['to_level_id'],
                            'from_semester' => $row['from_semester'],
                            'to_semester' => $row['to_semester'],
                            'action' => $row['action'],
                        ],
                        $actor,
                        'Student promoted'
                    );
                }
            }

            ActivityLogger::log(
                ActivityLogger::PROMOTION_BATCH_APPLIED,
                null,
                [
                    'count' => collect($list)->whereIn('action', ['promoted', 'graduated'])->count(),
                    'from_semester_id' => $options['from_semester_id'] ?? null,
                ],
                $actor,
                'Promotion batch applied'
            );

            return $list;
        });
    }

    protected function buildPromotionList(array $options, bool $dryRun = false): array
    {
        $fromSemesterId = $options['from_semester_id'] ?? null;
        $studentIds = $options['student_ids'] ?? [];
        $levelIds = $options['level_ids'] ?? [];
        $exclude = collect($options['exclude'] ?? [])->map(fn ($v) => (int) $v)->all();
        $graduateFinal = $options['graduate_final'] ?? true;

        $levels = Level::ordered()->get();
        $levelById = $levels->keyBy('id');
        $orderedIds = $levels->pluck('id')->all();
        $finalLevelId = end($orderedIds);

        $query = User::where('type', User::TYPE_STUDENT)
            ->where('status', User::STATUS_ACTIVE)
            ->with('student', 'level');

        if (! empty($studentIds)) {
            $query->whereIn('id', $studentIds);
        }

        if (! empty($levelIds)) {
            $query->where(function ($q) use ($levelIds) {
                $q->whereIn('level_id', $levelIds)->orWhereHas('student', fn ($qq) => $qq->whereIn('level_id', $levelIds));
            });
        }

        $result = [];
        foreach ($query->get() as $user) {
            $userLevelId = $user->level_id ?? $user->student?->level_id;
            $semesterEnum = $user->semester ?? $user->student?->semester;
            if (! $semesterEnum) {
                $semesterEnum = 'first';
            }

            if (in_array($user->id, $exclude, true)) {
                $result[] = $this->row($user, $userLevelId, $semesterEnum, $levelById, 'excluded');
                continue;
            }

            // idempotency
            if (! $dryRun && $fromSemesterId) {
                $exists = StudentPromotion::where('student_id', $user->id)
                    ->where('from_semester_id', $fromSemesterId)
                    ->exists();
                if ($exists) {
                    $result[] = $this->row($user, $userLevelId, $semesterEnum, $levelById, 'skipped');
                    continue;
                }
            }

            // determine next
            if ($semesterEnum === 'first') {
                // same level, second semester
                $result[] = $this->row($user, $userLevelId, $semesterEnum, $levelById, StudentPromotion::ACTION_PROMOTED, toLevelId: $userLevelId, toSemesterEnum: 'second');
                continue;
            }

            // second semester
            $isFinal = $userLevelId && $finalLevelId && (int) $userLevelId === (int) $finalLevelId;
            if ($isFinal && $graduateFinal) {
                $result[] = $this->row($user, $userLevelId, $semesterEnum, $levelById, StudentPromotion::ACTION_GRADUATED);
                continue;
            }

            // advance to next level, first semester
            $nextLevelId = $this->nextLevelId($orderedIds, $userLevelId);
            $toLevelId = $nextLevelId ?? $userLevelId;
            $result[] = $this->row($user, $userLevelId, $semesterEnum, $levelById, StudentPromotion::ACTION_PROMOTED, toLevelId: $toLevelId, toSemesterEnum: 'first');
        }

        return $result;
    }

    protected function row($user, $fromLevelId, $fromSemester, $levelById, $action, $toLevelId = null, $toSemesterEnum = null): array
    {
        return [
            'student_id' => $user->id,
            'name' => $user->name,
            'from_level_id' => $fromLevelId,
            'from_level' => $fromLevelId ? ($levelById[$fromLevelId]->name ?? null) : null,
            'from_semester' => $fromSemester,
            'to_level_id' => $toLevelId,
            'to_level' => $toLevelId ? ($levelById[$toLevelId]->name ?? null) : null,
            'to_semester' => $toSemesterEnum,
            'action' => $action,
        ];
    }

    protected function nextLevelId(array $orderedIds, $currentLevelId): ?int
    {
        if (! $currentLevelId) {
            return $orderedIds[0] ?? null;
        }
        $pos = array_search((int) $currentLevelId, array_map('intval', $orderedIds), true);
        if ($pos === false || $pos + 1 >= count($orderedIds)) {
            return null;
        }
        return $orderedIds[$pos + 1];
    }

    protected function countResolved(Semester $semester, string $status): int
    {
        return StudentCourse::where('status', $status)
            ->where(function ($q) use ($semester) {
                $q->where('semester_id', $semester->id)
                    ->orWhereHas('course', fn ($qq) => $qq->where('semester_id', $semester->id));
            })
            ->count();
    }
}
