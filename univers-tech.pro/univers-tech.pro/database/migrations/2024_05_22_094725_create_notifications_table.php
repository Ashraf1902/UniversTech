<?php

use App\Models\Admin;
use App\Models\User;
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
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('content');
            $table->foreignIdFor(User::class,'student_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->foreignIdFor(User::class,'professor_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->foreignIdFor(Admin::class,'admin_id')->nullable()->constrained('admins')->cascadeOnDelete();
            $table->boolean('type')->default(0); // 0 for notifications, 1 for events
            $table->string('image_path')->nullable();
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
        Schema::dropIfExists('notifications');
    }
};
