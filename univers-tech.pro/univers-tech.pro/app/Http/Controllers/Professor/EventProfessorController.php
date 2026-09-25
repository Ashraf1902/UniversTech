<?php

namespace App\Http\Controllers\Professor;

use App\Http\Controllers\Controller;
use App\Models\Event;
use Illuminate\Http\Request;

class EventProfessorController extends Controller
{
    public function latestEvents(Request $request)
    {
        $events = Event::orderByDesc('created_at')
            ->limit(10)
            ->get()
            ->map(fn (Event $event) => [
                'id' => $event->id,
                'name' => $event->title,
                'content' => $event->content,
                'image' => url('uploads/' . $event->image),
                'created_at' => $event->created_at,
                'updated_at' => $event->updated_at,
            ]);

        return SendResponse(200, 'Events fetched successfully.', $events);
    }
}
