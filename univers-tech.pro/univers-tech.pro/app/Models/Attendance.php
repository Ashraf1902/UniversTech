<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\LogsActivity;

class Attendance extends Model
{
    use HasFactory, SoftDeletes, LogsActivity;

    protected $table = 'attendances';

    protected $fillable = [
        'date',
        'status',
        'reason',
        'student_id',
        'professor_id',
        'lec_id',
        'course_id',
        'recorded_by_type',
        'recorded_by_id',
    ];

    protected $casts = [
        'status' => 'boolean',
        'date' => 'date',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function professor()
    {
        return $this->belongsTo(User::class, 'professor_id');
    }

    public function lecture()
    {
        return $this->belongsTo(Lecture::class, 'lec_id');
    }

    public function course()
    {
        return $this->belongsTo(Course::class, 'course_id');
    }

    public function recordedBy()
    {
        return $this->morphTo();
    }
}
