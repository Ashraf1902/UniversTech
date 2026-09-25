<?php

use App\Models\Lecture;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('student_lectures', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(User::class, 'student_id')->constrained('users')->onDelete('cascade');
            $table->foreignIdFor(Lecture::class, 'lecture_id')->constrained('lectures')->onDelete('cascade');
            $table->foreignId('course_id')->constrained()->onDelete('cascade');
            $table->timestamp('watched_at')->useCurrent();
            $table->unique(['student_id', 'lecture_id']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_lectures');
    }
};