<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rooms', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('building')->nullable();
            $table->unsignedInteger('capacity')->nullable();
            $table->timestamps();

            $table->unique(['name', 'building']);
        });

        Schema::table('schedules', function (Blueprint $table) {
            $table->foreignId('room_id')->nullable()->after('course_id')->constrained('rooms')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropConstrainedForeignId('room_id');
        });

        Schema::dropIfExists('rooms');
    }
};
