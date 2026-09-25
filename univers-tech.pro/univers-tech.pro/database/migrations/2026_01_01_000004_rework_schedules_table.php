<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            if ($this->hasForeign('schedules', 'level_id')) {
                $table->dropForeign(['level_id']);
            }
            $table->unsignedBigInteger('level_id')->nullable()->change();

            if (! Schema::hasColumn('schedules', 'semester_id')) {
                $table->foreignId('semester_id')->nullable()->after('level_id')->constrained()->nullOnDelete();
            }
            if (! Schema::hasColumn('schedules', 'department_id')) {
                $table->foreignId('department_id')->nullable()->after('semester_id')->constrained()->nullOnDelete();
            }
            if (! Schema::hasColumn('schedules', 'course_id')) {
                $table->foreignId('course_id')->nullable()->after('department_id')->constrained()->nullOnDelete();
            }
            if (! Schema::hasColumn('schedules', 'day_of_week')) {
                $table->string('day_of_week')->nullable()->after('course_id');
            }
            if (! Schema::hasColumn('schedules', 'start_time')) {
                $table->time('start_time')->nullable()->after('day_of_week');
            }
            if (! Schema::hasColumn('schedules', 'end_time')) {
                $table->time('end_time')->nullable()->after('start_time');
            }
            if (! Schema::hasColumn('schedules', 'section_type')) {
                $table->string('section_type')->default('lecture')->after('end_time');
            }

            $table->string('path')->nullable()->change();
            $table->foreign('level_id')->references('id')->on('levels')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            if ($this->hasForeign('schedules', 'semester_id')) {
                $table->dropForeign(['semester_id']);
            }
            if ($this->hasForeign('schedules', 'department_id')) {
                $table->dropForeign(['department_id']);
            }
            if ($this->hasForeign('schedules', 'course_id')) {
                $table->dropForeign(['course_id']);
            }
            if ($this->hasForeign('schedules', 'level_id')) {
                $table->dropForeign(['level_id']);
            }
            $table->dropColumn(['semester_id', 'department_id', 'course_id', 'day_of_week', 'start_time', 'end_time', 'section_type']);
            $table->string('path')->change();
            $table->foreign('level_id')->references('id')->on('levels')->cascadeOnDelete();
        });
    }

    private function hasForeign(string $table, string $column): bool
    {
        return DB::table('information_schema.KEY_COLUMN_USAGE')
            ->whereRaw('TABLE_SCHEMA = DATABASE()')
            ->where('TABLE_NAME', $table)
            ->where('COLUMN_NAME', $column)
            ->whereNotNull('REFERENCED_TABLE_NAME')
            ->exists();
    }
};
