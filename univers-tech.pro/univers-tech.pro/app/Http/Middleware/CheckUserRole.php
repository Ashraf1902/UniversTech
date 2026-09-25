<?php

namespace App\Http\Middleware;

use App\Models\Admin;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckUserRole
{
    /**
     * Ensure the authenticated user has one of the given roles.
     *
     * Supported roles: admin, professor, student.
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if ($user instanceof Admin && in_array('admin', $roles, true)) {
            return $next($request);
        }

        if ($user instanceof User && in_array($this->userRole($user), $roles, true)) {
            return $next($request);
        }

        return SendResponse(403, 'You are not authorized to perform this action.');
    }

    private function userRole(User $user): string
    {
        return $user->type === User::TYPE_PROFESSOR ? 'professor' : 'student';
    }
}