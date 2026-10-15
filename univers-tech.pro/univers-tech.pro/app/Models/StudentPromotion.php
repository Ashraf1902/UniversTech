<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StudentPromotion extends Model
{
    use HasFactory;

    public const ACTION_PROMOTED = 'promoted';
    public const ACTION_GRADUATED = 'graduated';

    protected $guarded = [];

    protected $casts = [
        'applied_at' => 'datetime',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function fromSemester()
    {
        return $this->belongsTo(Semester::class, 'from_semester_id');
    }

    public function toSemester()
    {
        return $this->belongsTo(Semester::class, 'to_semester_id');
    }

    public function fromLevel()
    {
        return $this->belongsTo(Level::class, 'from_level_id');
    }

    public function toLevel()
    {
        return $this->belongsTo(Level::class, 'to_level_id');
    }
}
