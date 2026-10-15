<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Auth\Passwords\CanResetPassword;
use Illuminate\Contracts\Auth\CanResetPassword as CanResetPasswordContract;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use App\Traits\LogsActivity;

class User extends Authenticatable implements CanResetPasswordContract
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes, LogsActivity, CanResetPassword;

    public const TYPE_STUDENT = 0;
    public const TYPE_PROFESSOR = 1;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_SUSPENDED = 'suspended';
    public const STATUS_GRADUATED = 'graduated';
    public const STATUS_INACTIVE = 'inactive';

    public const STATUSES = [
        self::STATUS_ACTIVE,
        self::STATUS_SUSPENDED,
        self::STATUS_GRADUATED,
        self::STATUS_INACTIVE,
    ];

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

    public function isActive(): bool
    {
        return ($this->status ?? self::STATUS_ACTIVE) === self::STATUS_ACTIVE;
    }

    public function statusMessage(): string
    {
        return match ($this->status) {
            self::STATUS_SUSPENDED => 'Your account has been suspended. Please contact the administration.',
            self::STATUS_GRADUATED => 'Your account has graduated and can no longer sign in. Please contact the administration.',
            self::STATUS_INACTIVE => 'Your account is inactive. Please contact the administration.',
            default => 'Your account is not active. Please contact the administration.',
        };
    }

    /**
     * Revoke every access token issued to this user. Used when the account
     * status changes so an already-issued token stops working immediately.
     */
    public function revokeTokens(): void
    {
        $this->tokens()->delete();
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

    public function gradeAppeals()
    {
        return $this->hasMany(GradeAppeal::class, 'student_id');
    }

    public function studentCourses()
    {
        return $this->hasMany(StudentCourse::class, 'student_id');
    }

    public function promotions()
    {
        return $this->hasMany(StudentPromotion::class, 'student_id');
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

    public function announcements()
    {
        return $this->hasMany(Announcement::class, 'professor_id');
    }
}