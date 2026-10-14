<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class ActivityLog extends Model
{
    use HasFactory;

    public const UPDATED_AT = null;

    protected $table = 'activity_logs';

    protected $guarded = [];

    protected $casts = [
        'properties' => 'array',
        'created_at' => 'datetime',
    ];

    public function actor(): MorphTo
    {
        return $this->morphTo();
    }

    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    public function scopeAction($query, ?string $action)
    {
        return $action ? $query->where('action', $action) : $query;
    }

    public function scopeActorType($query, ?string $type)
    {
        return $type ? $query->where('actor_type', $type) : $query;
    }
}
