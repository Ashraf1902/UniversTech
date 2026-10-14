<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_courses', function (Blueprint $table) {
            if (! $this->hasIndex('student_courses', 'student_courses_student_id_course_id_unique')) {
                $table->unique(['student_id', 'course_id']);
            }
        });

        Schema::table('schedules', function (Blueprint $table) {
            if (! $this->hasIndex('schedules', 'schedules_slot_unique')) {
                $table->unique(
                    ['level_id', 'semester_id', 'department_id', 'day_of_week', 'start_time', 'end_time', 'section_type'],
                    'schedules_slot_unique'
                );
            }
        });
    }

    public function down(): void
    {
        Schema::table('student_courses', function (Blueprint $table) {
            if ($this->hasIndex('student_courses', 'student_courses_student_id_course_id_unique')) {
                $table->dropUnique(['student_id', 'course_id']);
            }
        });

        Schema::table('schedules', function (Blueprint $table) {
            if ($this->hasIndex('schedules', 'schedules_slot_unique')) {
                $table->dropUnique('schedules_slot_unique');
            }
        });
    }

    private function hasIndex(string $table, string $index): bool
    {
        foreach (Schema::getIndexes($table) as $existing) {
            if (($existing['name'] ?? null) === $index) {
                return true;
            }
        }

        return false;
    }
};
