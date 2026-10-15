<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Marks an absence threshold (warn / bar) as already notified for one
 * student in one course so the notification is sent exactly once (S2).
 */
class AttendanceThresholdAlert extends Model
{
    use HasFactory;

    protected $table = 'attendance_threshold_alerts';

    protected $fillable = [
        'student_id',
        'course_id',
        'threshold',
        'notified_at',
    ];

    protected $casts = [
        'notified_at' => 'datetime',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function course()
    {
        return $this->belongsTo(Course::class, 'course_id');
    }
}
