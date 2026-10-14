<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();

            // Who performed the action. Null for system/unauthenticated events
            // such as a failed login attempt.
            $table->nullableMorphs('actor');

            // The record the action was performed on. Null for actions that do
            // not target a single record.
            $table->nullableMorphs('subject');

            $table->string('action', 60)->index();
            $table->string('description')->nullable();
            $table->json('properties')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->timestamp('created_at')->nullable()->index();

            // Actor timeline lookup (who did what, most recent first).
            $table->index(['actor_type', 'actor_id', 'created_at'], 'activity_logs_actor_created_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
