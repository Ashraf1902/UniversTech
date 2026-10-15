<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->string('category')->nullable()->after('type');
            $table->foreignId('course_id')->nullable()->after('category')->constrained('courses')->nullOnDelete();
            $table->foreignId('announcement_id')->nullable()->after('course_id')->constrained('announcements')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropConstrainedForeignId('announcement_id');
            $table->dropConstrainedForeignId('course_id');
            $table->dropColumn('category');
        });
    }
};
