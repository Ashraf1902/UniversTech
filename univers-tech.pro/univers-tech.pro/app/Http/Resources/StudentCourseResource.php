<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A course registered by a student (StudentCourse model).
 */
class StudentCourseResource extends JsonResource
{
    public function toArray($request)
    {
        $lectureCount = $this->course->lectures_count ?? $this->course->lectures?->count() ?? 0;

        return [
            'id' => $this->id,
            'course_id' => $this->course->id,
            'course_name' => $this->course->course_name,
            'course_code' => $this->course->course_code,
            'no_of_hours' => $this->course->no_of_hours,
            'course_professor' => $this->course->professor?->name,
            'cover_image' => url('uploads/' . $this->course->cover_image),
            'progress' => $this->progressCount($lectureCount),
            'progress_percent' => $this->progressPercent($lectureCount),
            'total_lectures' => $lectureCount,
            'status' => $this->status,
        ];
    }
}