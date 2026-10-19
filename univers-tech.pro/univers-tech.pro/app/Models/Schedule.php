<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\LogsActivity;

class Schedule extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'path',
        'level_id',
        'admin_id',
        'semester_id',
        'department_id',
        'course_id',
        'room_id',
        'day_of_week',
        'start_time',
        'end_time',
        'section_type',
    ];

    protected $casts = [
        'start_time' => 'datetime:H:i',
        'end_time' => 'datetime:H:i',
    ];

    /**
     * Chronological order of the teaching week (the campus week starts on
     * Saturday). Used to sort timetables by day instead of alphabetically.
     */
    public const WEEK_ORDER = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    public static function dayIndex(?string $day): int
    {
        $index = array_search(strtolower((string) $day), array_map('strtolower', self::WEEK_ORDER), true);

        return $index === false ? count(self::WEEK_ORDER) : $index;
    }

    public function admin()
    {
        return $this->belongsTo(Admin::class, 'admin_id');
    }

    public function level()
    {
        return $this->belongsTo(Level::class);
    }

    public function semester()
    {
        return $this->belongsTo(Semester::class);
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function room()
    {
        return $this->belongsTo(Room::class);
    }
}
