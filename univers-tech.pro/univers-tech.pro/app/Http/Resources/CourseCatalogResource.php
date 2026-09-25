<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A course from the catalog (Course model).
 */
class CourseCatalogResource extends JsonResource
{
    public function toArray($request)
    {
        return [
            'id' => $this->id,
            'course_name' => $this->course_name,
            'course_code' => $this->course_code,
            'no_of_hours' => $this->no_of_hours,
            'professor' => $this->professor?->name,
            'cover_image' => url('uploads/' . $this->cover_image),
        ];
    }
}