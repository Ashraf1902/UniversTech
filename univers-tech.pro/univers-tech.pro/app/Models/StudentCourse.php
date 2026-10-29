<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\LogsActivity;

class StudentCourse extends Model
{
    use HasFactory, LogsActivity;

    public const STATUS_REGISTERED = 'registered';
    public const STATUS_DROPPED = 'dropped';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';

    public const STATUSES = [
        self::STATUS_REGISTERED,
        self::STATUS_DROPPED,
        self::STATUS_COMPLETED,
        self::STATUS_FAILED,
    ];

    protected $guarded = [];

    protected $fillable = [
        'student_id',
        'course_id',
        'progress',
        'last_lecture_id',
        'status',
        'status_changed_at',
        'semester_id',
    ];

    protected $casts = [
        'status_changed_at' => 'datetime',
    ];

    /**
     * Watching lectures updates progress/last_lecture_id constantly; those are
     * study-state, not auditable events, so they never trigger a log entry.
     * Status transitions are logged explicitly via {@see changeStatus()}, so
     * they are ignored here to avoid a duplicate generic "updated" entry.
     *
     * @return array<int, string>
     */
    protected function activityLogIgnoredAttributes(): array
    {
        return ['progress', 'last_lecture_id', 'status', 'status_changed_at'];
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function course()
    {
        return $this->belongsTo(Course::class, 'course_id');
    }

    public function semester()
    {
        return $this->belongsTo(Semester::class);
    }

    public function lastLecture()
    {
        return $this->belongsTo(Lecture::class, 'last_lecture_id');
    }

    /**
     * Only currently-active enrollments (not dropped/withdrawn).
     */
    public function scopeRegistered($query)
    {
        return $query->where('status', self::STATUS_REGISTERED);
    }

    /**
     * The student's enrollments that belong to the currently-active semester.
     *
     * This is the single "current courses" rule shared by My Courses and the
     * student timetable so the two never disagree. Legacy enrollments with no
     * semester (NULL) are treated as belonging to the current term, which keeps
     * migrated data working until `data:backfill-semesters` assigns a semester.
     * When no semester is active the semester constraint is dropped so the
     * existing rows are still listed.
     */
    public function scopeCurrent($query)
    {
        $activeSemesterId = Semester::query()->where('is_active', true)->value('id');

        $query->where('status', self::STATUS_REGISTERED);

        if ($activeSemesterId) {
            $query->where(function ($q) use ($activeSemesterId) {
                $q->whereNull('semester_id')->orWhere('semester_id', $activeSemesterId);
            });
        }

        return $query;
    }

    public function isRegistered(): bool
    {
        return $this->status === self::STATUS_REGISTERED;
    }

    /**
     * Move the enrollment to a new status and audit the transition.
     */
    public function changeStatus(string $status, ?Model $actor = null, array $properties = []): void
    {
        if (! in_array($status, self::STATUSES, true)) {
            return;
        }

        $previous = $this->status;

        $this->forceFill([
            'status' => $status,
            'status_changed_at' => now(),
        ])->save();

        \App\Support\ActivityLogger::log(
            \App\Support\ActivityLogger::ENROLLMENT_STATUS_CHANGED,
            $this,
            array_merge([
                'from' => $previous,
                'to' => $status,
                'course_id' => $this->course_id,
                'student_id' => $this->student_id,
            ], $properties),
            $actor,
            'Enrollment status changed from ' . $previous . ' to ' . $status . '.'
        );
    }

    /**
     * Number of lectures the course currently has. A course belongs to exactly
     * one semester, so this is also the current-semester lecture total for the
     * enrollment.
     */
    public function lectureTotal(): int
    {
        return $this->course->lectures()->count();
    }

    /**
     * Watched lectures that still exist and belong to this enrollment's course.
     *
     * `student_lectures` keeps a course_id copy, so a row can outlive a course
     * change or point at a lecture from another course. Filtering through the
     * course's own lectures (and the course semester) keeps progress tied to the
     * lectures the student is actually taking this term.
     */
    public function watchedLectureIds()
    {
        $lectureIds = $this->course->lectures()->select('lectures.id');

        return StudentLecture::where('student_id', $this->student_id)
            ->where('course_id', $this->course_id)
            ->whereIn('lecture_id', $lectureIds)
            ->distinct()
            ->pluck('lecture_id');
    }

    /**
     * Progress derived from real watch records, capped at the lecture total.
     */
    public function watchedLectureCount(?int $total = null): int
    {
        $total ??= $this->lectureTotal();

        if ($total === 0) {
            return 0;
        }

        return min($this->watchedLectureIds()->count(), $total);
    }

    /**
     * Stored progress, clamped to the number of lectures the course has now.
     * Seeded/legacy rows can hold values above the total (e.g. 15 out of 3).
     */
    public function progressCount(?int $total = null): int
    {
        $total ??= $this->lectureTotal();

        return max(0, min((int) $this->progress, $total));
    }

    public function progressPercent(?int $total = null): int
    {
        $total ??= $this->lectureTotal();

        return $total > 0
            ? (int) round($this->progressCount($total) / $total * 100)
            : 0;
    }
}
