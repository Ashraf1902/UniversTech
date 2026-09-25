<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminAddEvent;
use App\Http\Requests\Admin\AdminUpdateEventRequest;
use App\Models\Event;
use App\Traits\File\DeleteFile;
use App\Traits\File\UpdateFile;
use App\Traits\File\UploadFile;
use App\Traits\Notifiable;
use Illuminate\Http\Request;

class EventAdminController extends Controller
{
    use UploadFile, DeleteFile, UpdateFile, Notifiable;

    public function index(Request $request)
    {
        $events = Event::orderByDesc('created_at')
            ->with('admin')
            ->paginate(15)
            ->through(fn (Event $event) => $this->formatEvent($event));

        return SendResponse(200, 'Events fetched successfully.', $events);
    }

    public function getEventById(Request $request, $id)
    {
        $event = Event::with('admin')->find($id);

        if (! $event) {
            return SendResponse(404, 'Event not found.');
        }

        return SendResponse(200, 'Event fetched successfully.', $this->formatEvent($event));
    }

    public function store(AdminAddEvent $request)
    {
        $image = $this->uploadFile($request, 'image', 'events');

        $event = Event::create([
            'title' => $request->title,
            'content' => $request->content,
            'admin_id' => $request->user()->id,
            'image' => $image,
        ]);

        $this->notifyAllStudents(
            $event->title,
            $event->content,
            $request->user()->id
        );

        $this->notifyAdmin(
            'New event created',
            '"' . $event->title . '" event has been published to all students.'
        );

        return SendResponse(201, 'Event created successfully.');
    }

    public function delete(Request $request, $id)
    {
        $event = Event::find($id);

        if (! $event) {
            return SendResponse(404, 'Event not found.');
        }

        $this->deleteFile($event->image);
        $event->delete();

        return SendResponse(200, 'Event deleted successfully.');
    }

    public function update(AdminUpdateEventRequest $request)
    {
        $event = Event::find($request->event_id);

        if (! $event) {
            return SendResponse(404, 'Event not found.');
        }

        $image = $event->image;

        if ($request->hasFile('image')) {
            $image = $this->updateFile($image, $request, 'image', 'events');
        }

        $event->update([
            'title' => $request->input('title', $event->title),
            'content' => $request->input('content', $event->content),
            'image' => $image,
        ]);

        return SendResponse(200, 'Event updated successfully.');
    }

    private function formatEvent(Event $event): array
    {
        return [
            'id' => $event->id,
            'title' => $event->title,
            'content' => $event->content,
            'image' => url('uploads/' . $event->image),
            'created_at' => $event->created_at,
            'updated_at' => $event->updated_at,
            'created_by' => $event->admin?->name,
        ];
    }
}
