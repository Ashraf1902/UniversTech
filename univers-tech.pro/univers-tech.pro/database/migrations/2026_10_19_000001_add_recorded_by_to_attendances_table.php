<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            $table->nullableMorphs('recorded_by');
        });

        // Backfill: attribute existing records to the course's professor if determinable.
        // Since schema doesn't link attendance to course/lecture directly in the core fields,
        // but we need to follow the "report choice" spirit. Leave as null for legacy rows
        // that cannot be confidently attributed; AttendanceAdminController writes values.
        // (No cross-DB heavy update required beyond leaving null.)
        // For completeness, we do nothing here to avoid assumptions.
    }

    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            $table->dropMorphs('recorded_by');
        });
    }
};
