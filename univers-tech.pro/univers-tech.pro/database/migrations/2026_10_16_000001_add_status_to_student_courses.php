<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_courses', function (Blueprint $table) {
            $table->string('status')->default('registered')->after('progress');
            $table->timestamp('status_changed_at')->nullable()->after('status');
            $table->foreignId('semester_id')->nullable()->after('status_changed_at')
                ->constrained('semesters')->nullOnDelete();
        });

        // Backfill the semester of every existing enrollment from its course.
        DB::table('student_courses')->update([
            'semester_id' => DB::raw('(select semester_id from courses where courses.id = student_courses.course_id)'),
        ]);
    }

    public function down(): void
    {
        Schema::table('student_courses', function (Blueprint $table) {
            $table->dropConstrainedForeignId('semester_id');
            $table->dropColumn(['status', 'status_changed_at']);
        });
    }
};
