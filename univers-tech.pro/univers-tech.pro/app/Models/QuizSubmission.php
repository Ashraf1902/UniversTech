<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class QuizSubmission extends Model
{
    use HasFactory;

    protected $fillable = [
        'quiz_id',
        'student_id',
        'file',
        'original_name',
        'answer_text',
        'submitted_at',
        'score',
        'feedback',
        'graded_by_type',
        'graded_by_id',
        'graded_at',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'graded_at' => 'datetime',
        'score' => 'float',
    ];

    public function quiz()
    {
        return $this->belongsTo(Quiz::class);
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function grader()
    {
        return $this->morphTo('graded_by');
    }

    public function isGraded(): bool
    {
        return $this->graded_at !== null;
    }

    /**
     * Sanitized filename offered in Content-Disposition. The original client
     * filename is display-only; it is never part of a storage path.
     */
    public function downloadName(): string
    {
        $original = $this->original_name
            ? basename(str_replace('\\', '/', $this->original_name))
            : '';

        $original = trim(preg_replace('/[\x00-\x1F\x7F"\\\\\/]+/', '', $original) ?? '');

        if ($original === '' || $original === '.' || $original === '..') {
            $extension = pathinfo((string) $this->file, PATHINFO_EXTENSION);
            $original = 'quiz-submission-' . $this->id . ($extension !== '' ? '.' . $extension : '');
        }

        return $original;
    }
}
