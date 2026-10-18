<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The live app ran CACHE_STORE=array and config/cache.php previously read
     * CACHE_DRIVER, so the configured driver was silently ignored. Stage 1's
     * login throttling and rate limits depend on a cache that survives across
     * requests and restarts, so the demo runs on the database store.
     *
     * Only the cache tables are created: this is a bearer-token API and does
     * not use the session driver (SESSION_DRIVER stays "array"), so no sessions
     * table is added.
     */
    public function up(): void
    {
        Schema::create('cache', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->mediumText('value');
            $table->integer('expiration');
        });

        Schema::create('cache_locks', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->string('owner');
            $table->integer('expiration');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cache_locks');
        Schema::dropIfExists('cache');
    }
};
