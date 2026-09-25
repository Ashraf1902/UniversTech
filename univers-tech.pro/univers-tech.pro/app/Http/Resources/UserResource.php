<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray($request)
    {
        $user = $this->resource->loadMissing([
            'admin',
            'student.department',
            'student.level',
            'professor.department',
        ]);

        $profile = $user->student ?? $user->professor;

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'national_id' => $user->nationalid,
            'gender' => $user->gender ? 'Female' : 'Male',
            'phone' => $user->phone,
            'credit_points' => $user->student?->credit_points,
            'semester' => $user->student?->semester,
            'type' => $user->type,
            'job_title' => $user->professor?->job_title,
            'admin' => $user->admin?->name,
            'department' => $profile?->department ? [
                'id' => $profile->department->id,
                'name' => $profile->department->name,
            ] : null,
            'level' => $user->student?->level ? [
                'id' => $user->student->level->id,
                'name' => $user->student->level->name,
            ] : null,
        ];
    }
}