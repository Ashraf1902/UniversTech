<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            if ($this->hasForeign('courses', 'department_id')) {
                $table->dropForeign(['department_id']);
            }
            if ($this->hasForeign('courses', 'professor_id')) {
                $table->dropForeign(['professor_id']);
            }

            $table->unsignedBigInteger('department_id')->nullable()->change();
            $table->unsignedBigInteger('professor_id')->nullable()->change();

            $table->foreign('department_id')->references('id')->on('departments')->nullOnDelete();
            $table->foreign('professor_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            if ($this->hasForeign('courses', 'department_id')) {
                $table->dropForeign(['department_id']);
            }
            if ($this->hasForeign('courses', 'professor_id')) {
                $table->dropForeign(['professor_id']);
            }

            $table->unsignedBigInteger('department_id')->nullable(false)->change();
            $table->unsignedBigInteger('professor_id')->nullable(false)->change();

            $table->foreign('department_id')->references('id')->on('departments')->cascadeOnDelete();
            $table->foreign('professor_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    private function hasForeign(string $table, string $column): bool
    {
        return DB::table('information_schema.KEY_COLUMN_USAGE')
            ->whereRaw('TABLE_SCHEMA = DATABASE()')
            ->where('TABLE_NAME', $table)
            ->where('COLUMN_NAME', $column)
            ->whereNotNull('REFERENCED_TABLE_NAME')
            ->exists();
    }
};
