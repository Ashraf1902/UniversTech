<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    public const TYPE_STUDENT = 0;
    public const TYPE_PROFESSOR = 1;

    protected $guarded = [];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'gender' => 'boolean',
        'type' => 'integer',
    ];

    public function isProfessor(): bool
    {
        return $this->type === self::TYPE_PROFESSOR;
    }

    public function isStudent(): bool
    {
        return $this->type === self::TYPE_STUDENT;
    }

    public function student()
    {
        return $this->hasOne(Student::class);
    }

    public function professor()
    {
        return $this->hasOne(Professor::class);
    }

    public function scopeStudents($query)
    {
        return $query->where('type', self::TYPE_STUDENT);
    }

    public function scopeProfessors($query)
    {
        return $query->where('type', self::TYPE_PROFESSOR);
    }

    public function admin()
    {
        return $this->belongsTo(Admin::class, 'admin_id');
    }

    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    public function level()
    {
        return $this->belongsTo(Level::class, 'level_id');
    }

    public function attendances()
    {
        return $this->hasMany(Attendance::class, 'student_id');
    }

    public function grades()
    {
        return $this->hasMany(Grade::class, 'student_id');
    }

    public function studentCourses()
    {
        return $this->hasMany(StudentCourse::class, 'student_id');
    }

    public function notifications()
    {
        return $this->hasMany(Notification::class, 'student_id');
    }

    public function notificationsAsProfessor()
    {
        return $this->hasMany(Notification::class, 'professor_id');
    }

    public function payments()
    {
        return $this->hasMany(Payment::class, 'user_id');
    }
}