<?php

namespace App\Support;

use Carbon\CarbonInterface;

/**
 * Detects time-slot conflicts between course schedules.
 *
 * Two slots conflict when they fall on the same day of the week and their
 * time ranges overlap (touching boundaries do not count as a conflict).
 */
class ScheduleOverlap
{
    /**
     * @param  array{day_of_week: int|string, start_time: mixed, end_time: mixed}  $a
     * @param  array{day_of_week: int|string, start_time: mixed, end_time: mixed}  $b
     */
    public static function conflicts(array $a, array $b): bool
    {
        if ((int) $a['day_of_week'] !== (int) $b['day_of_week']) {
            return false;
        }

        return static::toMinutes($a['start_time']) < static::toMinutes($b['end_time'])
            && static::toMinutes($a['end_time']) > static::toMinutes($b['start_time']);
    }

    /**
     * Normalise a time value (Carbon, "HH:MM" or "HH:MM:SS") to minutes.
     */
    public static function toMinutes(mixed $time): int
    {
        if ($time instanceof CarbonInterface) {
            return $time->hour * 60 + $time->minute;
        }

        $parts = explode(':', (string) $time);

        return ((int) ($parts[0] ?? 0)) * 60 + ((int) ($parts[1] ?? 0));
    }
}
