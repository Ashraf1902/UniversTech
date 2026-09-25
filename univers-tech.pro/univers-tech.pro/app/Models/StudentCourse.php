<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StudentCourse extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $fillable = [
        'student_id',
        'course_id',
        'progress',
        'last_lecture_id',
    ];

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