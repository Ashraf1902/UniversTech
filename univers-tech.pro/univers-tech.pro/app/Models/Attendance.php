<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Attendance extends Model
{
    use HasFactory;

    protected $table = 'attendances';

    protected $fillable = [
        'date',
        'status',
        'reason',
        'student_id',
        'professor_id',
        'lec_id',
        'course_id'
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
}