<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('grades', function (Blueprint $table) {
            // Existing grades default to "published" so current student reports
            // are unchanged by this migration.
            $table->string('status')->default('published')->index();
            $table->timestamp('published_at')->nullable();
            $table->nullableMorphs('published_by');
            $table->timestamp('locked_at')->nullable();
            $table->nullableMorphs('locked_by');
            $table->string('edit_reason')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('grades', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropMorphs('published_by');
            $table->dropMorphs('locked_by');
            $table->dropColumn(['status', 'published_at', 'locked_at', 'edit_reason']);
        });
    }
};
