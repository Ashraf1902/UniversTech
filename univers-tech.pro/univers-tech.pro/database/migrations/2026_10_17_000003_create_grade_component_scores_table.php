<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('grade_component_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('grade_id')->constrained('grades')->cascadeOnDelete();
            $table->foreignId('grade_component_id')->constrained('grade_components')->cascadeOnDelete();
            $table->decimal('marks', 5, 2)->default(0);
            $table->decimal('max_marks', 5, 2)->default(100);
            $table->timestamps();

            $table->unique(['grade_id', 'grade_component_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('grade_component_scores');
    }
};
