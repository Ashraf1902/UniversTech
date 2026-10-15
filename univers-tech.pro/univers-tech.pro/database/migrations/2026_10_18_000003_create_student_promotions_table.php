<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Records every promotion decision so a batch can be re-run safely: a
     * student is only promoted once per closed semester. It also doubles as the
     * per-student human-readable audit trail alongside the activity log.
     */
    public function up(): void
    {
        Schema::create('student_promotions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('from_semester_id')->nullable()->constrained('semesters')->nullOnDelete();
            $table->foreignId('to_semester_id')->nullable()->constrained('semesters')->nullOnDelete();
            $table->foreignId('from_level_id')->nullable()->constrained('levels')->nullOnDelete();
            $table->foreignId('to_level_id')->nullable()->constrained('levels')->nullOnDelete();
            $table->string('action'); // promoted | graduated
            $table->timestamp('applied_at')->nullable();
            $table->timestamps();

            $table->unique(['student_id', 'from_semester_id']);
            $table->index(['from_semester_id', 'action']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_promotions');
    }
};
