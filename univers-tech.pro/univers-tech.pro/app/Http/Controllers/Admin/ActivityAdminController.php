<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Admin;
use App\Models\User;
use Illuminate\Http\Request;

class ActivityAdminController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'action' => 'nullable|string|max:60',
            'actor_type' => 'nullable|string|in:admin,user',
            'subject_type' => 'nullable|string|max:120',
            'from' => 'nullable|date',
            'to' => 'nullable|date',
        ]);

        $logs = ActivityLog::query()
            ->with('actor')
            ->action($request->input('action'))
            ->when($request->filled('actor_type'), function ($q) use ($request) {
                $q->where('actor_type', $this->morphAlias($request->input('actor_type')));
            })
            ->when($request->filled('subject_type'), fn ($q) => $q->where('subject_type', $this->morphAlias($request->input('subject_type'))))
            ->when($request->filled('from'), fn ($q) => $q->where('created_at', '>=', $request->date('from')->startOfDay()))
            ->when($request->filled('to'), fn ($q) => $q->where('created_at', '<=', $request->date('to')->endOfDay()))
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = $request->search;
                $q->where(fn ($qq) => $qq->where('description', 'like', "%{$term}%")->orWhere('action', 'like', "%{$term}%"));
            })
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(20)
            ->through(fn (ActivityLog $log) => $this->format($log));

        return SendResponse(200, 'Activity log fetched successfully.', $logs);
    }

    /**
     * Map a short alias ("admin"/"user") to the stored morph class, while
     * still accepting a fully-qualified class name.
     */
    private function morphAlias(string $type): string
    {
        return match ($type) {
            'admin' => (new Admin)->getMorphClass(),
            'user' => (new User)->getMorphClass(),
            default => str_contains($type, '\\') ? $type : 'App\\Models\\' . $type,
        };
    }

    private function format(ActivityLog $log): array
    {
        return [
            'id' => $log->id,
            'action' => $log->action,
            'description' => $log->description,
            'actor' => $log->actor ? [
                'id' => $log->actor->id,
                'name' => $log->actor->name,
                'type' => class_basename($log->actor_type) === 'Admin' ? 'admin' : 'user',
            ] : null,
            'subject' => $log->subject_type ? [
                'type' => class_basename($log->subject_type),
                'id' => $log->subject_id,
            ] : null,
            'properties' => $log->properties,
            'ip_address' => $log->ip_address,
            'created_at' => $log->created_at,
        ];
    }
}
