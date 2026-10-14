<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Retention
    |--------------------------------------------------------------------------
    |
    | How long activity-log rows are kept. Pruning is disabled by default so
    | that entries are never destroyed automatically; enable it explicitly
    | (per environment) and schedule `activity-log:prune` when you want an
    | automatic cleanup policy.
    |
    */

    'retention_months' => (int) env('ACTIVITY_LOG_RETENTION_MONTHS', 24),

    'prune_enabled' => (bool) env('ACTIVITY_LOG_PRUNE_ENABLED', false),

];
