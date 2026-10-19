<?php

namespace App\Support;

/**
 * Single source of truth for how the payment gateway is configured.
 *
 * The demo-mode banner (GET /api/public/meta) and the payment endpoint
 * (POST /api/user/make-payment) must always agree, so both read these
 * helpers instead of re-deriving the flags themselves.
 */
class Payments
{
    /**
     * Demo mode is active only when the demo flag is explicitly enabled AND no
     * real gateway secret is present. In this mode payments are recorded as
     * paid without ever contacting the gateway — in any environment,
     * production included.
     */
    public static function demoMode(): bool
    {
        return static::demoFlagEnabled() && blank(config('services.stripe.secret'));
    }

    /**
     * A real gateway secret is present, so live payments can be initiated.
     */
    public static function isConfigured(): bool
    {
        return ! blank(config('services.stripe.secret'));
    }

    /**
     * Whether the demo flag is truthy. Accepts the string values that come from
     * environment variables ("true"/"1"/"false"/…) as well as real booleans.
     */
    public static function demoFlagEnabled(): bool
    {
        return filter_var(config('services.stripe.demo_mode'), FILTER_VALIDATE_BOOL) === true;
    }
}
