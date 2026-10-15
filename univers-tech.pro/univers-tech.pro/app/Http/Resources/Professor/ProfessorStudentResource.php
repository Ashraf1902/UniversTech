<?php

namespace App\Http\Resources\Professor;

use App\Models\Attendance;
use App\Services\AttendanceService;
use Illuminate\Http\Resources\Json\JsonResource;

class ProfessorStudentResource extends JsonResource
{
    public function toArray($request)
    {
        $attendances = $this->whenLoaded('attendances');

        $summary = null;

        if ($this->relationLoaded('attendances') && $this->attendances->count() > 0) {
            $summary = app(AttendanceService::class)->summarize($this->attendances, (int) $this->attendances->first()->course_id);
        }

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'gender' => $this->gender ? 'Female' : 'Male',
            'attendances' => $attendances,
            'attendance_summary' => $summary === null ? null : [
                'total' => $summary['total'],
                'present' => $summary['present'],
                'absent' => $summary['absent'],
                'absence_percentage' => $summary['absence_percentage'],
                'status' => $summary['status'],
                'warn_threshold' => $summary['warn_threshold'],
                'bar_threshold' => $summary['bar_threshold'],
            ],
        ];
    }
}
