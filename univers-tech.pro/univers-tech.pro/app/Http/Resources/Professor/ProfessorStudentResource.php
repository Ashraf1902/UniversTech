<?php

namespace App\Http\Resources\Professor;

use Illuminate\Http\Resources\Json\JsonResource;

class ProfessorStudentResource extends JsonResource
{
    public function toArray($request)
    {
        $attendances = $this->whenLoaded('attendances');

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'gender' => $this->gender ? 'Female' : 'Male',
            'attendances' => $attendances,
        ];
    }
}
