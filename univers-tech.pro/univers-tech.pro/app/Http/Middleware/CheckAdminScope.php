<?php

namespace App\Http\Middleware;

use App\Models\Admin;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckAdminScope
{
    /**
     * Ensure the authenticated admin is a super admin or has the given scope(s).
     *
     * Supported scopes: accounts, access_requests, departments, courses,
     * semesters, schedules, events, grades.
     */
    public function handle(Request $request, Closure $next, string ...$scopes): Response
    {
        $user = $request->user();

        if ($user instanceof Admin) {
            if ($user->isSuperAdmin()) {
                return $next($request);
            }

            foreach ($scopes as $scope) {
                if ($user->hasRole($scope)) {
                    return $next($request);
                }
            }
        }

        return SendResponse(403, 'You are not authorized to perform this action.');
    }
}