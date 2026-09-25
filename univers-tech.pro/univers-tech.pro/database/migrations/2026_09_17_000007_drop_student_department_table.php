<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('student_department');
    }

    public function down(): void
    {
        // Re-create original empty pivot table if needed
        Schema::create('student_department', function (\Illuminate\Database\Schema\Blueprint $table) {
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
            $table->timestamps();
        });
    }
};