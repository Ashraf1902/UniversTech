<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\LogsActivity;

class Grade extends Model
{
    use HasFactory, SoftDeletes, LogsActivity;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_PUBLISHED = 'published';
    public const STATUS_LOCKED = 'locked';

    public const STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_PUBLISHED,
        self::STATUS_LOCKED,
    ];

    protected $guarded = [];

    protected $casts = [
        'marks' => 'decimal:2',
        'max_marks' => 'decimal:2',
        'published_at' => 'datetime',
        'locked_at' => 'datetime',
    ];

    /**
     * Lifecycle transitions are logged explicitly by the grade service, so the
     * generic "updated" entry only needs to capture marks/reason edits.
     *
     * @return array<int, string>
     */
    protected function activityLogIgnoredAttributes(): array
    {
        return [
            'status',
            'published_at',
            'published_by_id',
            'published_by_type',
            'locked_at',
            'locked_by_id',
            'locked_by_type',
        ];
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function semester()
    {
        return $this->belongsTo(Semester::class);
    }

    public function componentScores()
    {
        return $this->hasMany(GradeComponentScore::class);
    }

    public function appeals()
    {
        return $this->hasMany(GradeAppeal::class);
    }

    public function publishedBy()
    {
        return $this->morphTo();
    }

    public function lockedBy()
    {
        return $this->morphTo();
    }

    public function scopeStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Grades a student is allowed to see (published or locked).
     */
    public function scopeVisible($query)
    {
        return $query->whereIn('status', [self::STATUS_PUBLISHED, self::STATUS_LOCKED]);
    }

    public function isDraft(): bool
    {
        return $this->status === self::STATUS_DRAFT;
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }

    public function isLocked(): bool
    {
        return $this->status === self::STATUS_LOCKED;
    }

    public function isVisibleToStudent(): bool
    {
        return ! $this->isDraft();
    }

    public static function percentageToGpa(float $percentage): array
    {
        $scale = [
            [90, 4.0, 'A'],
            [85, 3.7, 'A-'],
            [80, 3.3, 'B+'],
            [75, 3.0, 'B'],
            [70, 2.7, 'B-'],
            [65, 2.3, 'C+'],
            [60, 2.0, 'C'],
            [55, 1.7, 'C-'],
            [50, 1.0, 'D'],
        ];

        foreach ($scale as [$min, $points, $letter]) {
            if ($percentage >= $min) {
                return ['gpa_points' => $points, 'letter_grade' => $letter];
            }
        }

        return ['gpa_points' => 0.0, 'letter_grade' => 'F'];
    }

    public static function gpaToLetter(float $gpa): string
    {
        if ($gpa >= 3.85) return 'A';
        if ($gpa >= 3.5) return 'A-';
        if ($gpa >= 3.15) return 'B+';
        if ($gpa >= 2.85) return 'B';
        if ($gpa >= 2.5) return 'B-';
        if ($gpa >= 2.15) return 'C+';
        if ($gpa >= 1.85) return 'C';
        if ($gpa >= 1.5) return 'C-';
        if ($gpa >= 1.0) return 'D';

        return 'F';
    }
}
