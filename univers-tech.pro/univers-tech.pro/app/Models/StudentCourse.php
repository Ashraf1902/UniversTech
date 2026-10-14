<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\LogsActivity;

class StudentCourse extends Model
{
    use HasFactory, LogsActivity;

    protected $guarded = [];

    protected $fillable = [
        'student_id',
        'course_id',
        'progress',
        'last_lecture_id',
    ];

    /**
     * Watching lectures updates progress/last_lecture_id constantly; those are
     * study-state, not auditable events, so they never trigger a log entry.
     *
     * @return array<int, string>
     */
    protected function activityLogIgnoredAttributes(): array
    {
        return ['progress', 'last_lecture_id'];
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function course()
    {
        return $this->belongsTo(Course::class, 'course_id');
    }

    public function lastLecture()
    {
        return $this->belongsTo(Lecture::class, 'last_lecture_id');
    }

    public function watchedLectureIds()
    {
        return StudentLecture::where('student_id', $this->student_id)
            ->where('course_id', $this->course_id)
            ->pluck('lecture_id');
    }
}