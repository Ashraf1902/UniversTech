<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     *
     * @return void
     */
    public function register()
    {
        //
    }

    /**
     * Bootstrap any application services.
     *
     * @return void
     */
    public function boot()
    {
        if (app()->environment('production')) {
            \Illuminate\Support\Facades\URL::forceScheme('https');
        }

        // Login throttle keyed on the submitted email AND the client IP (rather
        // than Laravel's default per-IP-only bucket). This gives every account
        // its own lockout that survives a restart (the cache store is the DB),
        // so brute-forcing one account is rate-limited no matter which proxy IP
        // the request arrives from, while the key still separates attempts from
        // different source IPs. Applied to the three login routes as
        // `throttle:login` (routes/api.php); forgot/reset keep the plain limit.
        RateLimiter::for('login', function (Request $request) {
            $email = Str::lower(trim((string) $request->input('email')));

            return Limit::perMinute(5)->by($email . '|' . $request->ip());
        });
    }
}
