<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Level extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'position' => 'integer',
    ];

    public function schedules()
    {
        return $this->hasMany(Schedule::class, 'level_id');
    }

    /**
     * Ordered lowest → highest level (used by the rollover tool to find the
     * final level and to advance a student to the next one).
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('position')->orderBy('id');
    }
}
