<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'type' => 'boolean',
    ];

    const TYPE_NOTIFICATION = false;
    const TYPE_EVENT = true;

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function professor()
    {
        return $this->belongsTo(User::class, 'professor_id');
    }

    public function admin()
    {
        return $this->belongsTo(Admin::class, 'admin_id');
    }

    public function scopeForStudent($query, int $studentId)
    {
        return $query->where('student_id', $studentId);
    }

    public function scopeEvents($query)
    {
        return $query->where('type', self::TYPE_EVENT);
    }

    public function scopeNotifications($query)
    {
        return $query->where('type', self::TYPE_NOTIFICATION);
    }
}
