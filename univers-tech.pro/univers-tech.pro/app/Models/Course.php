<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;
use App\Traits\LogsActivity;

class Course extends Model
{
    use HasFactory, SoftDeletes, LogsActivity;

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
        'capacity',
    ];

    protected static function booted(): void
    {
        static::deleting(function (Course $course) {
            if (! $course->isForceDeleting()) {
                return;
            }

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

    public function gradeComponents()
    {
        return $this->hasMany(GradeComponent::class)->orderBy('position');
    }

    public function admin()
    {
        return $this->belongsTo(Admin::class, 'admin_id');
    }

    public function students()
    {
        return $this->belongsToMany(User::class, 'student_courses', 'course_id', 'student_id')
            ->withPivot(['progress', 'last_lecture_id', 'status', 'semester_id']);
    }

    /**
     * The courses that must be passed before this course can be taken.
     */
    public function prerequisites()
    {
        return $this->belongsToMany(
            Course::class,
            'course_prerequisites',
            'course_id',
            'prerequisite_course_id'
        );
    }

    /**
     * The courses for which this course is a prerequisite.
     */
    public function prerequisiteFor()
    {
        return $this->belongsToMany(
            Course::class,
            'course_prerequisites',
            'prerequisite_course_id',
            'course_id'
        );
    }

    public function schedules()
    {
        return $this->hasMany(Schedule::class);
    }
}