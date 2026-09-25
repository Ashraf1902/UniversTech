<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        DB::table('users')->where('type', 0)->orderBy('id')
            ->chunkById(500, function ($students) {
                $rows = $students->map(fn ($u) => [
                    'user_id'       => $u->id,
                    'department_id' => $u->department_id ?? null,
                    'level_id'      => $u->level_id ?? null,
                    'semester'      => $u->semester ?? null,
                    'credit_points' => $u->credit_points ?? 0,
                    'created_at'    => $u->created_at,
                    'updated_at'    => now(),
                ])->toArray();
                DB::table('students')->insert($rows);
            });

        DB::table('users')->where('type', 1)->orderBy('id')
            ->chunkById(500, function ($professors) {
                $rows = $professors->map(fn ($u) => [
                    'user_id'       => $u->id,
                    'department_id' => $u->department_id ?? null,
                    'job_title'     => $u->job_title ?? null,
                    'created_at'    => $u->created_at,
                    'updated_at'    => now(),
                ])->toArray();
                DB::table('professors')->insert($rows);
            });
    }

    public function down()
    {
        DB::table('students')->delete();
        DB::table('professors')->delete();
    }
};