<?php

use App\Models\Course;
use App\Models\Semester;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('grades', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(User::class, 'student_id')->constrained('users')->onDelete('cascade');
            $table->foreignIdFor(Course::class, 'course_id')->constrained('courses')->onDelete('cascade');
            $table->foreignIdFor(Semester::class, 'semester_id')->nullable()->constrained('semesters')->nullOnDelete();
            $table->decimal('marks', 5, 2);
            $table->decimal('max_marks', 5, 2)->default(100);
            $table->unique(['student_id', 'course_id', 'semester_id']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('grades');
    }
};