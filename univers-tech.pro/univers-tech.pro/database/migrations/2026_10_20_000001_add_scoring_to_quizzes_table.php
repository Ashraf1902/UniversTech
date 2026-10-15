<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quizzes', function (Blueprint $table) {
            $table->decimal('max_score', 8, 2)->default(100)->after('content');
            $table->timestamp('published_at')->nullable()->after('due_at');
        });

        // Existing quizzes were a pure file share (students could only
        // download them). Treat them as already published and give them the
        // default maximum score so they are not suddenly "unpublished".
        DB::table('quizzes')->update([
            'max_score' => 100,
            'published_at' => DB::raw('created_at'),
        ]);
    }

    public function down(): void
    {
        Schema::table('quizzes', function (Blueprint $table) {
            $table->dropColumn(['max_score', 'published_at']);
        });
    }
};
