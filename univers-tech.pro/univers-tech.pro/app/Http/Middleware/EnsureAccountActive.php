<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccountActive
{
    /**
     * Block requests from a student/professor whose account is no longer
     * active, even if they still hold a valid token. This complements the
     * token revocation performed when an admin changes the status.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user instanceof User && ! $user->isActive()) {
            $user->revokeTokens();

            return SendResponse(403, $user->statusMessage());
        }

        return $next($request);
    }
}
