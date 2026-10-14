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
            'capacity' => $this->capacity,
            'enrolled_count' => $this->enrolled_count ?? null,
            'seats_remaining' => $this->seats_remaining ?? null,
            'already_registered' => (bool) ($this->already_registered ?? false),
            'registration_open' => (bool) ($this->registration_open ?? true),
            'credit_limit' => $this->credit_limit ?? null,
            'drop_window_days' => $this->drop_window_days ?? null,
            'prerequisites' => $this->whenLoaded('prerequisites', fn () => $this->prerequisites->map(fn ($p) => [
                'id' => $p->id,
                'course_name' => $p->course_name,
                'course_code' => $p->course_code,
            ])->all()),
        ];
    }
}
