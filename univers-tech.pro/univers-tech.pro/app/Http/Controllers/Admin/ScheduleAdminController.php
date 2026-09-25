<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminAddScheduleRequest;
use App\Models\Schedule;
use App\Traits\File\DeleteFile;
use App\Traits\File\UpdateFile;
use App\Traits\File\UploadFile;
use App\Traits\Notifiable;
use Illuminate\Http\Request;

class ScheduleAdminController extends Controller
{
    use UploadFile, UpdateFile, DeleteFile, Notifiable;

    public function index(Request $request)
    {
        $schedules = Schedule::with(['level', 'semester', 'course', 'admin'])
            ->orderBy('day_of_week')
            ->orderBy('start_time')
            ->paginate(15);

        return SendResponse(200, 'Schedules fetched successfully.', $schedules);
    }

    public function store(AdminAddScheduleRequest $request)
    {
        $path = null;

        if ($request->hasFile('image')) {
            $path = $this->uploadFile($request, 'image', 'schedules');
        }

        $schedule = Schedule::create([
            'level_id' => $request->level_id,
            'semester_id' => $request->semester_id,
            'department_id' => $request->department_id,
            'course_id' => $request->course_id,
            'day_of_week' => $request->day_of_week,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'section_type' => $request->section_type,
            'admin_id' => $request->user()->id,
            'path' => $path,
        ]);

        $this->notifyAdmin(
            'Schedule entry added',
            'A schedule entry was added for "' . ($schedule->course?->course_name ?? 'a course') . '".'
        );

        return SendResponse(201, 'Schedule entry created successfully.');
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
        ]);

        $schedule = Schedule::find($request->schedule_id);

        $schedule->update([
            'day_of_week' => $request->input('day_of_week', $schedule->day_of_week),
            'start_time' => $request->input('start_time', $schedule->start_time),
            'end_time' => $request->input('end_time', $schedule->end_time),
            'section_type' => $request->input('section_type', $schedule->section_type),
            'course_id' => $request->input('course_id', $schedule->course_id),
            'level_id' => $request->input('level_id', $schedule->level_id),
            'semester_id' => $request->input('semester_id', $schedule->semester_id),
            'department_id' => $request->input('department_id', $schedule->department_id),
        ]);

        return SendResponse(200, 'Schedule updated successfully.');
    }
}
