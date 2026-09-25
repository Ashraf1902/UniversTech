<?php

namespace App\Http\Controllers\API\Student;

use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationsResource;
use App\Models\Notification;
use Illuminate\Http\Request;

class NotificationsController extends Controller
{
    public function notifications()
    {
        $notifications = Notification::where('student_id', auth()->id())
            ->with(['professor', 'admin'])
            ->latest()
            ->paginate(15);

        return SendResponse(200, 'Notifications fetched successfully.', NotificationsResource::collection($notifications));
    }

    public function events()
    {
        $events = Notification::where('type', Notification::TYPE_EVENT)
            ->with(['admin'])
            ->latest()
            ->paginate(15);

        return SendResponse(200, 'Events fetched successfully.', NotificationsResource::collection($events));
    }

    public function announcments()
    {
        $announcements = Notification::where(function ($query) {
            $query->where('student_id', auth()->id())
                ->orWhere(function ($query) {
                    $query->whereNull('student_id')
                        ->whereNull('professor_id')
                        ->whereNotNull('admin_id');
                });
        })
            ->with(['professor', 'admin'])
            ->latest()
            ->paginate(15);

        return SendResponse(200, 'Announcements fetched successfully.', NotificationsResource::collection($announcements));
    }
}
