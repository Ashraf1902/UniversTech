<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminAddScheduleRequest;
use App\Models\Schedule;
use App\Services\ScheduleService;
use App\Traits\File\DeleteFile;
use App\Traits\File\UpdateFile;
use App\Traits\File\UploadFile;
use App\Traits\Notifiable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ScheduleAdminController extends Controller
{
    use UploadFile, UpdateFile, DeleteFile, Notifiable;

    public function __construct(private ScheduleService $scheduleService)
    {
    }

    public function index(Request $request)
    {
        $schedules = Schedule::with(['level', 'semester', 'course.professor', 'room', 'admin'])
            ->orderBy('day_of_week')
            ->orderBy('start_time')
            ->paginate(15);

        return SendResponse(200, 'Schedules fetched successfully.', $schedules);
    }

    /**
     * Report of conflicts already stored (no automatic fixing).
     */
    public function conflicts()
    {
        $conflicts = $this->scheduleService->existingConflicts();

        return SendResponse(200, 'Schedule conflicts fetched successfully.', [
            'conflicts' => $conflicts,
            'count' => count($conflicts),
        ]);
    }

    public function store(AdminAddScheduleRequest $request)
    {
        $path = null;

        if ($request->hasFile('image')) {
            $path = $this->uploadFile($request, 'image', 'schedules');
        }

        $attributes = [
            'level_id' => $request->level_id,
            'semester_id' => $request->semester_id,
            'department_id' => $request->department_id,
            'course_id' => $request->course_id,
            'room_id' => $request->room_id,
            'day_of_week' => $request->day_of_week,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'section_type' => $request->section_type,
        ];

        $result = DB::transaction(function () use ($attributes, $path, $request) {
            Schedule::where('semester_id', $attributes['semester_id'])
                ->lockForUpdate()
                ->get();

            $check = $this->scheduleService->checkConflicts($attributes);

            if (! empty($check['conflicts'])) {
                return $check;
            }

            $schedule = Schedule::create($attributes + [
                'admin_id' => $request->user()->id,
                'path' => $path,
            ]);

            return $check + ['schedule' => $schedule];
        });

        if (! empty($result['conflicts'])) {
            if ($path) {
                $this->deleteFile($path);
            }

            return SendResponse(422, 'Schedule conflict detected.', [
                'conflicts' => $result['conflicts'],
                'warnings' => $result['warnings'],
            ]);
        }

        $this->notifyAdmin(
            'Schedule entry added',
            'A schedule entry was added for "' . ($result['schedule']->course?->course_name ?? 'a course') . '".'
        );

        return SendResponse(201, 'Schedule entry created successfully.', [
            'warnings' => $result['warnings'],
        ]);
    }

    public function delete(Request $request, $id)
    {
        $schedule = Schedule::find($id);

        if (! $schedule) {
            return SendResponse(404, 'Schedule entry not found.');
        }

        if ($schedule->path) {
            $this->deleteFile($schedule->path);
        }

        $schedule->delete();

        return SendResponse(200, 'Schedule entry deleted successfully.');
    }

    public function update(Request $request)
    {
        $request->validate([
            'schedule_id' => 'required|exists:schedules,id',
            'day_of_week' => 'nullable|string',
            'start_time' => 'nullable|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i',
            'section_type' => 'nullable|string|in:lecture,seminar,lab',
            'course_id' => 'nullable|exists:courses,id',
            'level_id' => 'nullable|exists:levels,id',
            'semester_id' => 'nullable|exists:semesters,id',
            'department_id' => 'nullable|exists:departments,id',
            'room_id' => 'nullable|exists:rooms,id',
        ]);

        $schedule = Schedule::find($request->schedule_id);

        $attributes = [
            'day_of_week' => $request->input('day_of_week', $schedule->day_of_week),
            'start_time' => $request->input('start_time', $schedule->start_time),
            'end_time' => $request->input('end_time', $schedule->end_time),
            'section_type' => $request->input('section_type', $schedule->section_type),
            'course_id' => $request->input('course_id', $schedule->course_id),
            'level_id' => $request->input('level_id', $schedule->level_id),
            'semester_id' => $request->input('semester_id', $schedule->semester_id),
            'department_id' => $request->input('department_id', $schedule->department_id),
            'room_id' => $request->input('room_id', $schedule->room_id),
        ];

        $result = DB::transaction(function () use ($schedule, $attributes) {
            Schedule::where('id', $schedule->id)->lockForUpdate()->get();

            $check = $this->scheduleService->checkConflicts($attributes, $schedule->id);

            if (! empty($check['conflicts'])) {
                return $check;
            }

            $schedule->update($attributes);

            return $check;
        });

        if (! empty($result['conflicts'])) {
            return SendResponse(422, 'Schedule conflict detected.', [
                'conflicts' => $result['conflicts'],
                'warnings' => $result['warnings'],
            ]);
        }

        return SendResponse(200, 'Schedule updated successfully.', [
            'warnings' => $result['warnings'],
        ]);
    }
}
