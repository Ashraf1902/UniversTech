<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * A student's score on one component of a course grade.
 */
class GradeComponentScore extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'marks' => 'decimal:2',
        'max_marks' => 'decimal:2',
    ];

    public function grade()
    {
        return $this->belongsTo(Grade::class);
    }

    public function component()
    {
        return $this->belongsTo(GradeComponent::class, 'grade_component_id');
    }

    public function percentage(): float
    {
        $max = (float) $this->max_marks;

        return $max > 0 ? round((float) $this->marks / $max * 100, 2) : 0.0;
    }
}
