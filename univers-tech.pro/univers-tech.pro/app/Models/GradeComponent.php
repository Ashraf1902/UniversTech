<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * A weighted assessment slot for a course (e.g. coursework / midterm / final).
 * The weights of all components of a course must total 100.
 *
 * Component definitions are audited explicitly by the sync endpoint rather than
 * per-row, so the model does not log itself.
 */
class GradeComponent extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'weight' => 'decimal:2',
        'position' => 'integer',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function scores()
    {
        return $this->hasMany(GradeComponentScore::class);
    }
}
