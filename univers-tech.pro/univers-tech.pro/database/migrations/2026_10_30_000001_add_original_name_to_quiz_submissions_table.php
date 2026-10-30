<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Store the client's original filename for display only. The on-disk
     * filename is always a generated UUID, so this column must never be used
     * to build a storage path.
     */
    public function up(): void
    {
        Schema::table('quiz_submissions', function (Blueprint $table) {
            $table->string('original_name')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('quiz_submissions', function (Blueprint $table) {
            $table->dropColumn('original_name');
        });
    }
};
