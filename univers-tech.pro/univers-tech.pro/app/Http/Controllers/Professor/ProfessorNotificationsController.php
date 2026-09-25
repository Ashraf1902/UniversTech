<?php

namespace App\Http\Controllers\Professor;

use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationsResource;
use App\Models\Notification;
use Illuminate\Http\Request;

class ProfessorNotificationsController extends Controller
{
    public function notifications(Request $request)
    {
        $notifications = Notification::where('professor_id', $request->user()->id)
            ->with(['professor', 'admin'])
            ->latest()
            ->paginate(15);

        return SendResponse(200, 'Notifications fetched successfully.', NotificationsResource::collection($notifications));
    }
}