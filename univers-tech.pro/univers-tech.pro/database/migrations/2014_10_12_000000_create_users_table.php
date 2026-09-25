<?php

use App\Models\Admin;
use App\Models\Department;
use App\Models\Level;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->boolean('gender'); // 0 is for male, 1 is for female
            $table->string('nationalid', 14)->nullable();
            $table->string('phone', 11)->nullable()->unique();
            $table->integer('credit_points')->nullable();
            $table->enum('semester', ['first', 'second'])->nullable();
            $table->boolean('type')->default('0');  //0 for student, 1 for professor
            $table->foreignIdFor(Admin::class)->constrained()->cascadeOnDelete();
            $table->foreignIdFor(Department::class)->nullable()->constrained()->cascadeOnDelete();
            $table->foreignIdFor(Level::class)->nullable()->constrained()->cascadeOnDelete();
            $table->rememberToken();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('users');
    }
};
