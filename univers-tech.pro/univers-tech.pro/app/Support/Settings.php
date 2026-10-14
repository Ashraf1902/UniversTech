<?php

namespace App\Support;

use App\Models\Setting;

/**
 * Typed access to the runtime-configurable enrollment policy values (§0.7).
 *
 * Values live in the `settings` table and fall back to config/enrollment.php
 * defaults when an admin has never changed them.
 */
class Settings
{
    /**
     * Read a policy value (with a config fallback).
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        $setting = Setting::where('key', $key)->first();

        if ($setting === null || $setting->value === null) {
            return $default ?? config("enrollment.{$key}");
        }

        return $setting->value;
    }

    /**
     * Persist a policy value.
     */
    public static function set(string $key, mixed $value): void
    {
        Setting::updateOrCreate(['key' => $key], ['value' => $value]);
    }

    public static function creditLimit(): int
    {
        return (int) static::get('credit_limit');
    }

    public static function passingScore(): int
    {
        return (int) static::get('passing_score');
    }

    public static function dropWindowDays(): int
    {
        return (int) static::get('drop_window_days');
    }

    public static function gradeEditWindowHours(): int
    {
        return (int) static::get('grade_edit_window_hours');
    }

    public static function appealWindowDays(): int
    {
        return (int) static::get('appeal_window_days');
    }
}
