<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        $now = now();

        DB::table('settings')->insert([
            ['key' => 'credit_limit', 'value' => json_encode(18), 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'passing_score', 'value' => json_encode(50), 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'drop_window_days', 'value' => json_encode(14), 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
