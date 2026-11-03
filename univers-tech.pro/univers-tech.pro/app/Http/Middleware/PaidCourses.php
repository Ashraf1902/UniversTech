<?php

namespace App\Http\Middleware;

use App\Models\Payment;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Http\Request;

class PaidCourses
{
    /**
     * Handle an incoming request.
     *
     * Courses content unlocks for the academic year a payment was made in,
     * using the campus calendar (config/university.php): from the 1st of the
     * configured start month to the day before that month next year, in the
     * campus timezone. Paid/waived only; a refund removes access (S4), and a
     * pending/failed payment never grants it.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function handle(Request $request, Closure $next)
    {
        $timezone = config('university.timezone', 'Africa/Cairo');
        $startMonth = max(1, min(12, (int) config('university.academic_year_start_month', 9)));

        $now = CarbonImmutable::now($timezone);
        $startYear = $now->month >= $startMonth ? $now->year : $now->year - 1;

        // Compare in the application timezone (the zone timestamps are stored
        // in), not the campus zone, so the query binds the same wall-clock the
        // database row was written with.
        $startsAt = CarbonImmutable::create($startYear, $startMonth, 1, 0, 0, 0, $timezone)
            ->setTimezone(config('app.timezone'));
        $endsAt = $startsAt->addYear();

        $hasPaidForCourses = auth()->user()->payments()
            ->where('type', Payment::TYPE_COURSES)
            ->whereIn('status', [Payment::STATUS_PAID, Payment::STATUS_WAIVED])
            ->where(function ($query) use ($startsAt, $endsAt) {
                // Prefer the moment the payment was actually made (paid_at),
                // falling back to the row's creation time when it is absent.
                $query->where(function ($query) use ($startsAt, $endsAt) {
                    $query->whereNotNull('paid_at')
                        ->where('paid_at', '>=', $startsAt)
                        ->where('paid_at', '<', $endsAt);
                })->orWhere(function ($query) use ($startsAt, $endsAt) {
                    $query->whereNull('paid_at')
                        ->where('created_at', '>=', $startsAt)
                        ->where('created_at', '<', $endsAt);
                });
            })
            ->exists();

        if (! $hasPaidForCourses) {
            return SendResponse(403, 'You did not pay for any course yet. Please pay first.');
        }

        return $next($request);
    }
}
