<?php

namespace App\Http\Middleware;

use App\Models\Payment;
use Closure;
use Illuminate\Http\Request;

class PaidCourses
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function handle(Request $request, Closure $next)
    {
        // A payment grants access while it is paid or waived; a refund removes
        // that access (S4).
        $hasPaidForCourses = auth()->user()->payments()
            ->where('type', Payment::TYPE_COURSES)
            ->whereIn('status', [Payment::STATUS_PAID, Payment::STATUS_WAIVED])
            ->whereYear('created_at', now()->year)
            ->exists();

        if (! $hasPaidForCourses) {
            return SendResponse(403, 'You did not pay for any course yet. Please pay first.');
        }

        return $next($request);
    }
}
