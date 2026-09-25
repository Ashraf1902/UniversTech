<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Detailed view of a course a student registered for (StudentCourse model).
 */
class CourseDetailResource extends JsonResource
{
    public function toArray($request)
    {
        $lectures = $this->course->lectures;

        $progress = $lectures->count() > 0
            ? min(intval($this->progress) / $lectures->count() * 100, 100)
            : 0;

        return [
            'id' => $this->id,
            'course_id' => $this->course->id,
            'course_name' => $this->course->course_name,
            'course_code' => $this->course->course_code,
            'course_professor' => $this->course->professor?->name,
            'cover_image' => url('uploads/' . $this->course->cover_image),
            'progress_percent' => $progress,
            'lectures' => LecturesResource::collection($lectures),
            'quizzes' => QuizResource::collection($this->course->quizzes),
        ];
    }
}