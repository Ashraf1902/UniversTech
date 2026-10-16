<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Supporting indexes for the A8 reports. All report queries aggregate with
 * GROUP BY over these columns, so the covering indexes keep them efficient on
 * large datasets.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->index(['status', 'paid_at'], 'payments_status_paid_at_index');
        });

        Schema::table('attendances', function (Blueprint $table) {
            $table->index(['course_id', 'date'], 'attendances_course_id_date_index');
        });

        Schema::table('student_courses', function (Blueprint $table) {
            $table->index(['semester_id', 'status'], 'student_courses_semester_status_index');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex('payments_status_paid_at_index');
        });

        Schema::table('attendances', function (Blueprint $table) {
            $table->dropIndex('attendances_course_id_date_index');
        });

        Schema::table('student_courses', function (Blueprint $table) {
            $table->dropIndex('student_courses_semester_status_index');
        });
    }
};
