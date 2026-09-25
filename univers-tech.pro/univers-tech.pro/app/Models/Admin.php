<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Foundation\Auth\User as Authenticatable;

class Admin extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'is_super_admin',
        'roles',
    ];

    protected $casts = [
        'is_super_admin' => 'boolean',
        'roles' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    public function isSuperAdmin(): bool
    {
        return $this->is_super_admin;
    }

    public function hasRole(string $scope): bool
    {
        if ($this->is_super_admin) {
            return true;
        }

        return in_array($scope, $this->roles ?? [], true);
    }

    public function users()
    {
        return $this->hasMany(User::class, 'admin_id');
    }

    public function payments()
    {
        return $this->hasMany(Payment::class, 'admin_id');
    }

    public function departments()
    {
        return $this->hasMany(Department::class, 'admin_id');
    }

    public function notifications()
    {
        return $this->hasMany(Notification::class, 'admin_id');
    }

    public function events()
    {
        return $this->hasMany(Event::class, 'admin_id');
    }
}
