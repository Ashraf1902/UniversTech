<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Event;
use App\Models\Level;
use Illuminate\Http\Request;

class PublicController extends Controller
{
    public function events(Request $request)
    {
        $events = Event::orderByDesc('created_at')
            ->limit(6)
            ->get()
            ->map(fn (Event $event) => [
                'id' => $event->id,
                'title' => $event->title,
                'content' => $event->content,
                'image' => url('uploads/' . $event->image),
                'created_at' => $event->created_at,
            ])
            ->values();

        return SendResponse(200, 'Events fetched successfully.', $events);
    }

    public function meta(Request $request)
    {
        return SendResponse(200, 'Meta fetched successfully.', [
            'levels' => Level::orderBy('id')->get(['id', 'name']),
            'departments' => Department::orderBy('name')->get(['id', 'name']),
        ]);
    }
}