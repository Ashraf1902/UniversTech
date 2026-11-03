<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;
use App\Traits\LogsActivity;

class Quiz extends Model
{
    use HasFactory, LogsActivity;

    protected static function booted(): void
    {
        // quiz_submissions.quiz_id cascades on delete at the database level,
        // so the child models are never instantiated and their own deleting
        // event never fires. Purge the confidential files here instead.
        static::deleting(function (Quiz $quiz) {
            $files = $quiz->submissions()
                ->whereNotNull('file')
                ->pluck('file')
                ->all();

            if ($files !== []) {
                Storage::disk('private')->delete($files);
            }
        });
    }

    protected $fillable = [
        'name',
        'content',
        'course_id',
        'max_score',
        'due_at',
        'published_at',
    ];

    protected $casts = [
        'due_at' => 'datetime',
        'published_at' => 'datetime',
        'max_score' => 'float',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function submissions()
    {
        return $this->hasMany(QuizSubmission::class);
    }

    public function isPublished(): bool
    {
        return $this->published_at !== null;
    }

    public function isPastDue(): bool
    {
        return $this->due_at !== null && $this->due_at->isPast();
    }
}