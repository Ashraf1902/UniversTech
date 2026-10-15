<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminAddEvent;
use App\Http\Requests\Admin\AdminUpdateEventRequest;
use App\Models\Department;
use App\Models\Event;
use App\Models\Level;
use App\Models\Student;
use App\Traits\File\DeleteFile;
use App\Traits\File\UpdateFile;
use App\Traits\File\UploadFile;
use App\Traits\Notifiable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EventAdminController extends Controller
{
    use UploadFile, DeleteFile, UpdateFile, Notifiable;

    public function index(Request $request)
    {
        $events = Event::query()
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = $request->search;
                $q->where(fn ($qq) => $qq->where('title', 'like', "%{$term}%")->orWhere('content', 'like', "%{$term}%"));
            })
            ->orderByDesc('created_at')
            ->with(['admin', 'departments:id,name', 'levels:id,name'])
            ->paginate(15)
            ->through(fn (Event $event) => $this->formatEvent($event));

        return SendResponse(200, 'Events fetched successfully.', $events);
    }

    public function getEventById(Request $request, $id)
    {
        $event = Event::with(['admin', 'departments:id,name', 'levels:id,name'])->find($id);

        if (! $event) {
            return SendResponse(404, 'Event not found.');
        }

        return SendResponse(200, 'Event fetched successfully.', $this->formatEvent($event));
    }

    public function store(AdminAddEvent $request)
    {
        $audience = $this->resolveAudience($request);

        if (! is_string($audience)) {
            return SendResponse(422, 'Targeted events require at least one department or level.');
        }

        $departmentIds = $audience === Event::AUDIENCE_TARGETED
            ? array_map('intval', $request->input('departments', []))
            : [];

        $levelIds = $audience === Event::AUDIENCE_TARGETED
            ? array_map('intval', $request->input('levels', []))
            : [];

        $image = $this->uploadFile($request, 'image', 'events');

        DB::transaction(function () use ($request, $image, $audience, $departmentIds, $levelIds) {
            $event = Event::create([
                'title' => $request->title,
                'content' => $request->content,
                'admin_id' => $request->user()->id,
                'image' => $image,
                'audience' => $audience,
            ]);

            if ($audience === Event::AUDIENCE_TARGETED) {
                $this->syncTargets($event, $departmentIds, $levelIds);

                $this->notifyEventToStudents(
                    $this->targetedStudentIds($departmentIds, $levelIds),
                    $event->title,
                    $event->content,
                    $request->user()->id
                );

                $this->notifyAdmin(
                    'New event created',
                    '"' . $event->title . '" event has been published to targeted departments and levels.'
                );

                return;
            }

            $this->notifyAllStudents(
                $event->title,
                $event->content,
                $request->user()->id
            );

            $this->notifyAdmin(
                'New event created',
                '"' . $event->title . '" event has been published to all students.'
            );
        });

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

        $audience = $event->audience;

        if ($request->filled('audience')) {
            $audience = $request->audience;
        }

        $departmentIds = $request->filled('departments')
            ? array_map('intval', $request->input('departments', []))
            : $event->departments()->pluck('departments.id')->map(fn ($id) => (int) $id)->all();

        $levelIds = $request->filled('levels')
            ? array_map('intval', $request->input('levels', []))
            : $event->levels()->pluck('levels.id')->map(fn ($id) => (int) $id)->all();

        if ($audience === Event::AUDIENCE_TARGETED && empty($departmentIds) && empty($levelIds)) {
            return SendResponse(422, 'Targeted events require at least one department or level.');
        }

        DB::transaction(function () use ($event, $request, $image, $audience, $departmentIds, $levelIds) {
            $event->update([
                'title' => $request->input('title', $event->title),
                'content' => $request->input('content', $event->content),
                'image' => $image,
                'audience' => $audience,
            ]);

            if ($audience === Event::AUDIENCE_TARGETED) {
                $this->syncTargets($event, $departmentIds, $levelIds);
            } else {
                $event->departments()->detach();
                $event->levels()->detach();
            }
        });

        return SendResponse(200, 'Event updated successfully.');
    }

    private function formatEvent(Event $event): array
    {
        return [
            'id' => $event->id,
            'title' => $event->title,
            'content' => $event->content,
            'image' => url('uploads/' . $event->image),
            'audience' => $event->audience,
            'target_departments' => $event->departments->map(fn (Department $department) => [
                'id' => $department->id,
                'name' => $department->name,
            ])->values()->all(),
            'target_levels' => $event->levels->map(fn (Level $level) => [
                'id' => $level->id,
                'name' => $level->name,
            ])->values()->all(),
            'created_at' => $event->created_at,
            'updated_at' => $event->updated_at,
            'created_by' => $event->admin?->name,
        ];
    }

    /**
     * Validate and normalize the requested audience value.
     *
     * @return string|null A valid audience, or null when targeting is empty.
     */
    private function resolveAudience(Request $request): ?string
    {
        $audience = $request->input('audience', Event::AUDIENCE_ALL);

        if (! in_array($audience, [Event::AUDIENCE_ALL, Event::AUDIENCE_TARGETED], true)) {
            return null;
        }

        if ($audience === Event::AUDIENCE_TARGETED
            && empty($request->input('departments', []))
            && empty($request->input('levels', []))) {
            return null;
        }

        return $audience;
    }

    /**
     * @param  array<int, int>  $departmentIds
     * @param  array<int, int>  $levelIds
     */
    private function syncTargets(Event $event, array $departmentIds, array $levelIds): void
    {
        $event->departments()->sync($departmentIds);
        $event->levels()->sync($levelIds);
    }

    /**
     * Resolve the user ids of students matching the targeted departments or levels.
     *
     * @param  array<int, int>  $departmentIds
     * @param  array<int, int>  $levelIds
     * @return array<int, int>
     */
    private function targetedStudentIds(array $departmentIds, array $levelIds): array
    {
        return Student::query()
            ->when(! empty($departmentIds), fn ($q) => $q->orWhereIn('department_id', $departmentIds))
            ->when(! empty($levelIds), fn ($q) => $q->orWhereIn('level_id', $levelIds))
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }
}
