<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\LogsActivity;

class Room extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'name',
        'building',
        'capacity',
    ];

    protected $casts = [
        'capacity' => 'integer',
    ];

    public function schedules()
    {
        return $this->hasMany(Schedule::class);
    }
}
