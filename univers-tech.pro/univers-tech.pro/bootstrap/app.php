<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
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
        // The app runs behind the Vercel rewrite (browser -> Vercel -> Wasmer Edge),
        // so the TCP peer is always a proxy and the real client IP only arrives in
        // X-Forwarded-For. Trusting the proxy chain makes $request->ip() return that
        // client IP, which the login throttle keys on (see AppServiceProvider).
        //
        // Only FOR and PROTO are trusted: X-Forwarded-Host/Port are deliberately
        // ignored so a spoofed Host header cannot poison generated URLs. Set
        // TRUSTED_PROXIES to the proxy addresses once they are stable; "*" is the
        // only workable value while the edge IPs are unknown.
        $middleware->trustProxies(
            at: env('TRUSTED_PROXIES', '*'),
            headers: Request::HEADER_X_FORWARDED_FOR | Request::HEADER_X_FORWARDED_PROTO,
        );

        $middleware->statefulApi();

        $middleware->alias([
            'role' => \App\Http\Middleware\CheckUserRole::class,
            'admin-scope' => \App\Http\Middleware\CheckAdminScope::class,
            'paid-courses' => \App\Http\Middleware\PaidCourses::class,
            'active' => \App\Http\Middleware\EnsureAccountActive::class,
        ]);
    })
    ->withSchedule(function (\Illuminate\Console\Scheduling\Schedule $schedule) {
        $schedule->command('notify:lecture-reminders')->dailyAt('08:00');
        $schedule->command('notify:lecture-reminders')->dailyAt('16:00');
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Render every API validation failure with the same envelope the
        // FormRequest `FetchRequestError` trait uses, so inline $request->validate()
        // calls and FormRequest errors return an identical body shape:
        // { status: 422, message: "error in body request", data: { field: [...] } }
        $exceptions->render(function (\Illuminate\Validation\ValidationException $e, \Illuminate\Http\Request $request) {
            if ($request->is('api/*')) {
                return SendResponse(
                    status: 422,
                    message: 'error in body request',
                    data: $e->errors()
                );
            }
        });
    })->create();