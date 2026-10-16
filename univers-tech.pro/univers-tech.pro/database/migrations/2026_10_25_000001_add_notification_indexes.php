<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The student notification feed filters by recipient and orders by the most
     * recent first (`where student_id = ? order by created_at desc`), and the
     * event/announcement feeds filter by type. Foreign keys already index the
     * recipient columns on their own; these composite indexes cover the
     * filter + sort combination so the feed never falls back to a filesort as
     * the fan-out table grows.
     */
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->index(['student_id', 'created_at'], 'notifications_student_created_index');
            $table->index(['type', 'created_at'], 'notifications_type_created_index');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex('notifications_student_created_index');
            $table->dropIndex('notifications_type_created_index');
        });
    }
};
