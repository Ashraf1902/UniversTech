<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;

class FanOutNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 60;

    public int $tries = 3;

    /** @var array<int, array<string, mixed>> */
    public array $rows;

    /**
     * @param  array<int, array<string, mixed>>  $rows
     */
    public function __construct(array $rows)
    {
        $this->rows = $rows;
    }

    public function handle(): void
    {
        if (empty($this->rows)) {
            return;
        }

        foreach (array_chunk($this->rows, 500) as $chunk) {
            DB::table('notifications')->insert($chunk);
        }
    }
}