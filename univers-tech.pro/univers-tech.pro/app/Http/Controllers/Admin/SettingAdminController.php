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
            'grade_edit_window_hours' => Settings::gradeEditWindowHours(),
            'appeal_window_days' => Settings::appealWindowDays(),
            'attendance_edit_window_hours' => Settings::attendanceEditWindowHours(),
            'attendance_warn_threshold' => Settings::attendanceWarnThreshold(),
            'attendance_bar_threshold' => Settings::attendanceBarThreshold(),
            'quiz_allow_resubmit' => Settings::quizAllowResubmit(),
            'quiz_allow_late' => Settings::quizAllowLate(),
            'quiz_submission_max_kb' => Settings::quizSubmissionMaxKb(),
            'flag_refund_on_drop' => Settings::flagRefundOnDrop(),
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
            'grade_edit_window_hours' => 'required|integer|min:0|max:8760',
            'appeal_window_days' => 'required|integer|min:0|max:365',
            'attendance_edit_window_hours' => 'nullable|integer|min:0|max:8760',
            'attendance_warn_threshold' => 'nullable|integer|min:0|max:100',
            'attendance_bar_threshold' => 'nullable|integer|min:0|max:100',
            'quiz_allow_resubmit' => 'nullable|boolean',
            'quiz_allow_late' => 'nullable|boolean',
            'quiz_submission_max_kb' => 'nullable|integer|min:1|max:102400',
            'flag_refund_on_drop' => 'nullable|boolean',
        ]);

        // Attendance policy fields were added in Stage 7: keep older clients
        // working by falling back to the currently stored value when absent.
        $data['attendance_edit_window_hours'] = $data['attendance_edit_window_hours'] ?? Settings::attendanceEditWindowHours();
        $data['attendance_warn_threshold'] = $data['attendance_warn_threshold'] ?? Settings::attendanceWarnThreshold();
        $data['attendance_bar_threshold'] = $data['attendance_bar_threshold'] ?? Settings::attendanceBarThreshold();

        // Quiz submission policy fields were added in Stage 8 (same fallback).
        $data['quiz_allow_resubmit'] = array_key_exists('quiz_allow_resubmit', $data) ? (int) $data['quiz_allow_resubmit'] : (int) Settings::quizAllowResubmit();
        $data['quiz_allow_late'] = array_key_exists('quiz_allow_late', $data) ? (int) $data['quiz_allow_late'] : (int) Settings::quizAllowLate();
        $data['quiz_submission_max_kb'] = $data['quiz_submission_max_kb'] ?? Settings::quizSubmissionMaxKb();

        // Payment policy fields were added in Stage 9 (same fallback).
        $data['flag_refund_on_drop'] = array_key_exists('flag_refund_on_drop', $data) ? (int) $data['flag_refund_on_drop'] : (int) Settings::flagRefundOnDrop();

        if ($data['attendance_bar_threshold'] < $data['attendance_warn_threshold']) {
            return SendResponse(422, 'error in body request', [
                'attendance_bar_threshold' => ['The attendance bar threshold must be greater than or equal to the warning threshold.'],
            ]);
        }

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

        return SendResponse(200, 'Settings updated successfully.', $this->current());
    }

    /**
     * @return array<string, mixed>
     */
    private function current(): array
    {
        return [
            'credit_limit' => Settings::creditLimit(),
            'passing_score' => Settings::passingScore(),
            'drop_window_days' => Settings::dropWindowDays(),
            'grade_edit_window_hours' => Settings::gradeEditWindowHours(),
            'appeal_window_days' => Settings::appealWindowDays(),
            'attendance_edit_window_hours' => Settings::attendanceEditWindowHours(),
            'attendance_warn_threshold' => Settings::attendanceWarnThreshold(),
            'attendance_bar_threshold' => Settings::attendanceBarThreshold(),
            'quiz_allow_resubmit' => Settings::quizAllowResubmit(),
            'quiz_allow_late' => Settings::quizAllowLate(),
            'quiz_submission_max_kb' => Settings::quizSubmissionMaxKb(),
            'flag_refund_on_drop' => Settings::flagRefundOnDrop(),
        ];
    }
}
