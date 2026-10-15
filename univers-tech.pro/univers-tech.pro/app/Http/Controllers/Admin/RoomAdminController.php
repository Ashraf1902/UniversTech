<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Room;
use App\Traits\Notifiable;
use Illuminate\Http\Request;

class RoomAdminController extends Controller
{
    use Notifiable;

    public function index(Request $request)
    {
        $rooms = Room::withCount('schedules')
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = $request->search;
                $q->where(fn ($qq) => $qq->where('name', 'like', "%{$term}%")->orWhere('building', 'like', "%{$term}%"));
            })
            ->orderBy('building')
            ->orderBy('name')
            ->paginate(15);

        return SendResponse(200, 'Rooms fetched successfully.', $rooms);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'building' => ['nullable', 'string', 'max:100'],
            'capacity' => ['nullable', 'integer', 'min:1'],
        ]);

        $exists = Room::where('name', $data['name'])
            ->where('building', $data['building'] ?? null)
            ->exists();

        if ($exists) {
            return SendResponse(422, 'A room with this name already exists in the building.');
        }

        $room = Room::create($data);

        return SendResponse(201, 'Room created successfully.', $room);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'room_id' => ['required', 'exists:rooms,id'],
            'name' => ['sometimes', 'string', 'max:100'],
            'building' => ['nullable', 'string', 'max:100'],
            'capacity' => ['nullable', 'integer', 'min:1'],
        ]);

        $room = Room::find($request->room_id);

        $duplicate = Room::where('id', '!=', $room->id)
            ->where('name', $request->input('name', $room->name))
            ->where('building', $request->input('building', $room->building))
            ->exists();

        if ($duplicate) {
            return SendResponse(422, 'A room with this name already exists in the building.');
        }

        $room->update([
            'name' => $request->input('name', $room->name),
            'building' => $request->has('building') ? $request->input('building') : $room->building,
            'capacity' => $request->has('capacity') ? $request->input('capacity') : $room->capacity,
        ]);

        return SendResponse(200, 'Room updated successfully.', $room);
    }

    public function delete(Request $request, $id)
    {
        $room = Room::find($id);

        if (! $room) {
            return SendResponse(404, 'Room not found.');
        }

        $room->delete();

        return SendResponse(200, 'Room deleted successfully.');
    }
}
