<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;

class RecordActivityLog implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 60;

    public int $tries = 3;

    /** @var array<string, mixed> */
    public array $row;

    /**
     * @param  array<string, mixed>  $row
     */
    public function __construct(array $row)
    {
        $this->row = $row;
    }

    public function handle(): void
    {
        if (empty($this->row)) {
            return;
        }

        DB::table('activity_logs')->insert($this->row);
    }
}
