<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Course extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $fillable = [
        'course_name',
        'no_of_hours',
        'course_code',
        'cover_image',
        'department_id',
        'professor_id',
        'admin_id',
        'semester_id',
    ];

    protected static function booted(): void
    {
        static::deleting(function (Course $course) {
            Storage::disk('files')->delete($course->cover_image);

            foreach ($course->lectures as $lecture) {
                Storage::disk('files')->delete($lecture->content);
            }

            foreach ($course->schedules as $schedule) {
                if ($schedule->path) {
                    Storage::disk('files')->delete($schedule->path);
                }
            }
        });
    }

    public function professor()
    {
        return $this->belongsTo(User::class, 'professor_id');
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function semester()
    {
        return $this->belongsTo(Semester::class);
    }

    public function lectures()
    {
        return $this->hasMany(Lecture::class, 'course_id');
    }

    public function quizzes()
    {
        return $this->hasMany(Quiz::class);
    }

    public function grades()
    {
        return $this->hasMany(Grade::class);
    }

    public function admin()
    {
        return $this->belongsTo(Admin::class, 'admin_id');
    }

    public function students()
    {
        return $this->belongsToMany(User::class, 'student_courses', 'course_id', 'student_id');
    }

    public function schedules()
    {
        return $this->hasMany(Schedule::class);
    }
}