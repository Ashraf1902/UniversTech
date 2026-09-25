<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
        then: function () {
            Route::prefix('api/user')
                ->middleware(['api', 'auth:sanctum'])
                ->group(base_path('routes/user-api.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'role' => \App\Http\Middleware\CheckUserRole::class,
            'admin-scope' => \App\Http\Middleware\CheckAdminScope::class,
            'paid-courses' => \App\Http\Middleware\PaidCourses::class,
        ]);
    })
    ->withSchedule(function (\Illuminate\Console\Scheduling\Schedule $schedule) {
        $schedule->command('notify:lecture-reminders')->dailyAt('08:00');
        $schedule->command('notify:lecture-reminders')->dailyAt('16:00');
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();