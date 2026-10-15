<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->string('audience')->default('all')->after('content');
        });

        Schema::create('event_departments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->cascadeOnDelete();
            $table->foreignId('department_id')->constrained()->cascadeOnDelete();
            $table->unique(['event_id', 'department_id']);
        });

        Schema::create('event_levels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->cascadeOnDelete();
            $table->foreignId('level_id')->constrained()->cascadeOnDelete();
            $table->unique(['event_id', 'level_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_levels');
        Schema::dropIfExists('event_departments');

        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn('audience');
        });
    }
};
