<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AccessRequest extends Model
{
    use HasFactory;

    public const STATUS_PENDING = 'pending';
    public const STATUS_ACCEPTED = 'accepted';
    public const STATUS_REFUSED = 'refused';

    protected $fillable = [
        'name',
        'email',
        'password',
        'phone',
        'national_id',
        'gender',
        'level_id',
        'department_id',
        'status',
        'admin_id',
        'decided_at',
    ];

    protected $casts = [
        'gender' => 'boolean',
        'decided_at' => 'datetime',
    ];

    public function level()
    {
        return $this->belongsTo(Level::class);
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function admin()
    {
        return $this->belongsTo(Admin::class);
    }
}