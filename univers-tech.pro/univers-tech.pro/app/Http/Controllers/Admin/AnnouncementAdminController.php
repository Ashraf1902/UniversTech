<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Notification;
use App\Traits\File\DeleteFile;
use Illuminate\Http\Request;

class AnnouncementAdminController extends Controller
{
    use DeleteFile;

    public function index(Request $request)
    {
        $announcements = Announcement::query()
            ->when($request->filled('course_id'), fn ($q) => $q->where('course_id', $request->input('course_id')))
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = $request->search;
                $q->where(fn ($qq) => $qq->where('title', 'like', "%{$term}%")->orWhere('body', 'like', "%{$term}%"));
            })
            ->with(['course:id,course_name,course_code', 'professor:id,name', 'admin:id,name'])
            ->orderByDesc('created_at')
            ->paginate(15)
            ->through(fn (Announcement $announcement) => $this->format($announcement));

        return SendResponse(200, 'Announcements fetched successfully.', $announcements);
    }

    private function format(Announcement $announcement): array
    {
        return [
            'id' => $announcement->id,
            'course_id' => $announcement->course_id,
            'course_name' => $announcement->course?->course_name,
            'course_code' => $announcement->course?->course_code,
            'author' => $announcement->professor?->name ?? $announcement->admin?->name,
            'author_type' => $announcement->professor_id ? 'professor' : 'admin',
            'title' => $announcement->title,
            'body' => $announcement->body,
            'attachment' => $announcement->attachment ? url('uploads/' . $announcement->attachment) : null,
            'created_at' => $announcement->created_at,
            'updated_at' => $announcement->updated_at,
        ];
    }

    public function delete(Request $request, $id)
    {
        $announcement = Announcement::find($id);

        if (! $announcement) {
            return SendResponse(404, 'Announcement not found.');
        }

        if ($announcement->attachment) {
            $this->deleteFile($announcement->attachment);
        }

        Notification::where('announcement_id', $announcement->id)->delete();
        $announcement->delete();

        return SendResponse(200, 'Announcement removed successfully.');
    }
}
