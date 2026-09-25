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

        $progressPercent = $lectureCount > 0
            ? min(intval($this->progress) / $lectureCount * 100, 100)
            : 0;

        return [
            'id' => $this->id,
            'course_id' => $this->course->id,
            'course_name' => $this->course->course_name,
            'course_code' => $this->course->course_code,
            'course_professor' => $this->course->professor?->name,
            'cover_image' => url('uploads/' . $this->course->cover_image),
            'progress' => $this->progress,
            'progress_percent' => $progressPercent,
            'total_lectures' => $lectureCount,
        ];
    }
}