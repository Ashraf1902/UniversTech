<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StudentLecture extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'watched_at' => 'datetime',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function lecture()
    {
        return $this->belongsTo(Lecture::class);
    }

    public function course()
    {
        return $this->belongsTo(Course::class);
    }
}