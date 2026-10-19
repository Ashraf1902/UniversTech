<?php

namespace App\Support;

use Carbon\Carbon;

/**
 * Formats the university's wall-clock values in the campus timezone.
 *
 * Timetable columns are plain `time` values (no timezone); they represent the
 * campus's local time. The app itself runs in UTC, so every value is parsed and
 * rendered in the configured university timezone to keep what is stored and
 * what is displayed identical regardless of the app timezone.
 */
class UniversityTime
{
    public static function timezone(): string
    {
        return (string) config('university.timezone', 'Africa/Cairo');
    }

    /**
     * Render a stored time (e.g. "09:00:00") as HH:mm in the university timezone.
     */
    public static function time(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return Carbon::parse($value, static::timezone())->format('H:i');
    }
}
