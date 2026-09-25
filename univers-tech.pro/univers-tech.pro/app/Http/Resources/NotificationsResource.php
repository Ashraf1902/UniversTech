<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class NotificationsResource extends JsonResource
{
    public function toArray($request)
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'content' => 'Dear ' . auth()->user()->name . "\n" . $this->content,
            'type' => $this->type ? 'event' : 'notification',
            'professor' => $this->professor?->name,
            'admin' => $this->admin?->name,
            'image_path' => $this->image_path ? url('uploads/' . $this->image_path) : null,
            'created_at' => $this->created_at->diffForHumans(),
        ];
    }
}
