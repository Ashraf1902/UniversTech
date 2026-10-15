<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_threshold_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->string('threshold');
            $table->timestamp('notified_at');
            $table->timestamps();

            $table->unique(['student_id', 'course_id', 'threshold']);
            $table->index(['course_id', 'student_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_threshold_alerts');
    }
};
