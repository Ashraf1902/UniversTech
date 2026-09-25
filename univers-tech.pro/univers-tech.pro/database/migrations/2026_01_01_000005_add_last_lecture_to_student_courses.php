<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_courses', function (Blueprint $table) {
            $table->foreignId('last_lecture_id')->nullable()->after('progress')->constrained('lectures')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('student_courses', function (Blueprint $table) {
            $table->dropForeign(['last_lecture_id']);
            $table->dropColumn('last_lecture_id');
        });
    }
};
