<?php

namespace App\Http\Controllers\Professor;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Schedule;
use App\Models\Semester;
use App\Support\UniversityTime;
use Illuminate\Http\Request;

class ScheduleProfessorController extends Controller
{
    /**
     * Weekly timetable for the acting professor (P4).
     *
     * Only schedules belonging to courses the professor owns are returned,
     * limited to the currently active semester.
     */
    public function index(Request $request)
    {
        $professorId = $request->user()->id;

        $courseIds = Course::where('professor_id', $professorId)->pluck('id');

        $activeSemester = Semester::where('is_active', true)->first();

        $query = Schedule::with(['course:id,course_name,course_code', 'room:id,name,building', 'semester:id,name'])
            ->whereIn('course_id', $courseIds);

        if ($activeSemester) {
            $query->where('semester_id', $activeSemester->id);
        }

        $schedules = $query
            ->get()
            ->sortBy(fn (Schedule $schedule) => sprintf(
                '%02d|%s',
                Schedule::dayIndex($schedule->day_of_week),
                (string) $schedule->getRawOriginal('start_time')
            ))
            ->values()
            ->map(fn (Schedule $schedule) => [
                'id' => $schedule->id,
                'day_of_week' => $schedule->day_of_week,
                'start_time' => UniversityTime::time($schedule->getRawOriginal('start_time')),
                'end_time' => UniversityTime::time($schedule->getRawOriginal('end_time')),
                'section_type' => $schedule->section_type,
                'course_id' => $schedule->course_id,
                'course_name' => $schedule->course?->course_name,
                'course_code' => $schedule->course?->course_code,
                'room' => $schedule->room?->name,
                'building' => $schedule->room?->building,
                'semester' => $schedule->semester?->name,
                'path' => $schedule->path ? url('uploads/' . $schedule->path) : null,
            ]);

        return SendResponse(200, 'Timetable fetched successfully.', [
            'active_semester' => $activeSemester?->name,
            'schedule' => $schedules,
        ]);
    }
}
