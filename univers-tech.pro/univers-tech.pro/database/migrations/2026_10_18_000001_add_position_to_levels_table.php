<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Levels are ordered (Level 1 → Level 4); the stage-6 rollover tool needs to
     * know which level is the final one so it can graduate students. `position`
     * makes that ordering explicit instead of relying on insertion id order.
     */
    public function up(): void
    {
        Schema::table('levels', function (Blueprint $table) {
            $table->unsignedInteger('position')->nullable()->after('name');
        });

        // Backfill by existing id order so current data keeps its meaning.
        foreach (DB::table('levels')->orderBy('id')->pluck('id') as $index => $id) {
            DB::table('levels')->where('id', $id)->update(['position' => $index + 1]);
        }
    }

    public function down(): void
    {
        Schema::table('levels', function (Blueprint $table) {
            $table->dropColumn('position');
        });
    }
};
