<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use Illuminate\Console\Command;

class PruneActivityLog extends Command
{
    protected $signature = 'activity-log:prune {--force : Run even when pruning is disabled in config}';

    protected $description = 'Delete activity-log entries older than the configured retention window.';

    public function handle(): int
    {
        if (! config('activity-log.prune_enabled') && ! $this->option('force')) {
            $this->warn('Activity-log pruning is disabled. Set ACTIVITY_LOG_PRUNE_ENABLED=true or pass --force.');

            return self::SUCCESS;
        }

        $months = (int) config('activity-log.retention_months', 24);
        $cutoff = now()->subMonths($months);

        $deleted = ActivityLog::where('created_at', '<', $cutoff)->delete();

        $this->info("Pruned {$deleted} activity-log entries older than {$months} months ({$cutoff->toDateString()}).");

        return self::SUCCESS;
    }
}
