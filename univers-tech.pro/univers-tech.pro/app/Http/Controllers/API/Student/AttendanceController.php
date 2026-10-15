<?php

namespace App\Http\Controllers\API\Student;

use App\Http\Controllers\Controller;
use App\Services\AttendanceService;
use App\Traits\Notifiable;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    use Notifiable;

    public function __construct(private AttendanceService $attendanceStats)
    {
    }

    /**
     * Per enrolled course: attendance records, counts, absence percentage and
     * the warn / exam-barred status. Threshold notifications are evaluated
     * (queued, once per threshold) whenever the student opens the page.
     */
    public function index(Request $request)
    {
        $studentId = (int) $request->user()->id;

        $courses = $this->attendanceStats->studentCourses($studentId);

        foreach ($courses as $course) {
            $this->attendanceStats->notifyThresholds($studentId, (int) $course['course_id']);
        }

        return SendResponse(200, 'Attendance fetched successfully.', [
            'courses' => $courses,
            'thresholds' => [
                'warn' => array_column($courses, 'warn_threshold')[0] ?? 15,
                'bar' => array_column($courses, 'bar_threshold')[0] ?? 25,
            ],
        ]);
    }
}
