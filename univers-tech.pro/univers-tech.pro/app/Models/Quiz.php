<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\LogsActivity;

class Quiz extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'name',
        'content',
        'course_id',
        'due_at',
    ];

    protected $casts = [
        'due_at' => 'datetime',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }
}