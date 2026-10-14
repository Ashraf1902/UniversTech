<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\ActivityLogger;
use App\Support\Settings;
use Illuminate\Http\Request;

class SettingAdminController extends Controller
{
    /**
     * Current enrollment policy values.
     */
    public function index()
    {
        return SendResponse(200, 'Settings fetched successfully.', [
            'credit_limit' => Settings::creditLimit(),
            'passing_score' => Settings::passingScore(),
            'drop_window_days' => Settings::dropWindowDays(),
            'defaults' => config('enrollment'),
        ]);
    }

    /**
     * Update the enrollment policy values.
     */
    public function update(Request $request)
    {
        $data = $request->validate([
            'credit_limit' => 'required|integer|min:0|max:60',
            'passing_score' => 'required|integer|min:0|max:100',
            'drop_window_days' => 'required|integer|min:0|max:365',
        ]);

        foreach ($data as $key => $value) {
            Settings::set($key, (int) $value);
        }

        ActivityLogger::log(
            ActivityLogger::SETTINGS_UPDATED,
            null,
            $data,
            null,
            'Enrollment settings updated.'
        );

        return SendResponse(200, 'Settings updated successfully.', [
            'credit_limit' => Settings::creditLimit(),
            'passing_score' => Settings::passingScore(),
            'drop_window_days' => Settings::dropWindowDays(),
        ]);
    }
}
