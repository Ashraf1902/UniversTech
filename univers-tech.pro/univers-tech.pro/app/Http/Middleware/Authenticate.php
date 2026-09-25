<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    /**
     * This is an API-only application, so unauthenticated requests are always rejected
     * rather than redirected to a (non-existent) login route.
     */
    protected function redirectTo(Request $request): ?string
    {
        return null;
    }
}