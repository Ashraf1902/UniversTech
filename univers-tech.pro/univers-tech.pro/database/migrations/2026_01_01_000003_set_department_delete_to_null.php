<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if ($this->hasForeign('users', 'department_id')) {
                $table->dropForeign(['department_id']);
            }
            $table->unsignedBigInteger('department_id')->nullable()->change();
            $table->foreign('department_id')->references('id')->on('departments')->nullOnDelete();
        });

        Schema::table('courses', function (Blueprint $table) {
            if ($this->hasForeign('courses', 'department_id')) {
                $table->dropForeign(['department_id']);
            }
            $table->unsignedBigInteger('department_id')->nullable()->change();
            $table->foreign('department_id')->references('id')->on('departments')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if ($this->hasForeign('users', 'department_id')) {
                $table->dropForeign(['department_id']);
            }
            $table->foreign('department_id')->references('id')->on('departments')->cascadeOnDelete();
        });

        Schema::table('courses', function (Blueprint $table) {
            if ($this->hasForeign('courses', 'department_id')) {
                $table->dropForeign(['department_id']);
            }
            $table->foreign('department_id')->references('id')->on('departments')->cascadeOnDelete();
        });
    }

    private function hasForeign(string $table, string $column): bool
    {
        foreach (Schema::getForeignKeys($table) as $foreignKey) {
            $columns = $foreignKey['columns'] ?? [];

            if (is_string($columns)) {
                $columns = array_map('trim', explode(',', $columns));
            }

            if (in_array($column, $columns, true)) {
                return true;
            }
        }

        return false;
    }
};
