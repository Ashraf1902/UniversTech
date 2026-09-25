<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray($request)
    {
        $user = $this->resource->loadMissing(['admin', 'department', 'level']);

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'national_id' => $user->nationalid,
            'gender' => $user->gender ? 'Female' : 'Male',
            'phone' => $user->phone,
            'credit_points' => $user->credit_points,
            'semester' => $user->semester,
            'type' => $user->type,
            'job_title' => $user->job_title,
            'admin' => $user->admin?->name,
            'department' => $user->department ? [
                'id' => $user->department->id,
                'name' => $user->department->name,
            ] : null,
            'level' => $user->level ? [
                'id' => $user->level->id,
                'name' => $user->level->name,
            ] : null,
        ];
    }
}
