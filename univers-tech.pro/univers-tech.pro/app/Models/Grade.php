<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Grade extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'marks' => 'decimal:2',
        'max_marks' => 'decimal:2',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function semester()
    {
        return $this->belongsTo(Semester::class);
    }

    public static function percentageToGpa(float $percentage): array
    {
        $scale = [
            [90, 4.0, 'A'],
            [85, 3.7, 'A-'],
            [80, 3.3, 'B+'],
            [75, 3.0, 'B'],
            [70, 2.7, 'B-'],
            [65, 2.3, 'C+'],
            [60, 2.0, 'C'],
            [55, 1.7, 'C-'],
            [50, 1.0, 'D'],
        ];

        foreach ($scale as [$min, $points, $letter]) {
            if ($percentage >= $min) {
                return ['gpa_points' => $points, 'letter_grade' => $letter];
            }
        }

        return ['gpa_points' => 0.0, 'letter_grade' => 'F'];
    }

    public static function gpaToLetter(float $gpa): string
    {
        if ($gpa >= 3.85) return 'A';
        if ($gpa >= 3.5) return 'A-';
        if ($gpa >= 3.15) return 'B+';
        if ($gpa >= 2.85) return 'B';
        if ($gpa >= 2.5) return 'B-';
        if ($gpa >= 2.15) return 'C+';
        if ($gpa >= 1.85) return 'C';
        if ($gpa >= 1.5) return 'C-';
        if ($gpa >= 1.0) return 'D';

        return 'F';
    }
}