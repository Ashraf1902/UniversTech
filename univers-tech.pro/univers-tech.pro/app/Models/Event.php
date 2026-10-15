<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\LogsActivity;

class Event extends Model
{
    use HasFactory, LogsActivity;

    public const AUDIENCE_ALL = 'all';
    public const AUDIENCE_TARGETED = 'targeted';

    protected $table = 'events';

    protected $fillable = [
        'title',
        'content',
        'admin_id',
        'image',
        'audience',
    ];

    public function admin()
    {
        return $this->belongsTo(Admin::class);
    }

    public function departments()
    {
        return $this->belongsToMany(Department::class, 'event_departments');
    }

    public function levels()
    {
        return $this->belongsToMany(Level::class, 'event_levels');
    }

    public function isTargeted(): bool
    {
        return $this->audience === self::AUDIENCE_TARGETED;
    }
}
