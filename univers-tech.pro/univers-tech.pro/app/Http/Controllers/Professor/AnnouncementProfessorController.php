<?php

namespace App\Http\Controllers\Professor;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Course;
use App\Models\Notification;
use App\Models\StudentCourse;
use App\Http\Requests\Professor\ProfessorStoreAnnouncementRequest;
use App\Http\Requests\Professor\ProfessorUpdateAnnouncementRequest;
use App\Traits\AuthorizesCourseOwnership;
use App\Traits\File\DeleteFile;
use App\Traits\File\UpdateFile;
use App\Traits\File\UploadFile;
use App\Traits\Notifiable;
use Illuminate\Http\Request;

class AnnouncementProfessorController extends Controller
{
    use AuthorizesCourseOwnership, UploadFile, UpdateFile, DeleteFile, Notifiable;

    public function index(Request $request)
    {
        $announcements = Announcement::where('professor_id', $request->user()->id)
            ->when($request->filled('course_id'), fn ($q) => $q->where('course_id', $request->input('course_id')))
            ->with(['course:id,course_name,course_code'])
            ->orderByDesc('created_at')
            ->paginate(15);

        return SendResponse(200, 'Announcements fetched successfully.', $announcements);
    }

    public function store(ProfessorStoreAnnouncementRequest $request)
    {
        $course = Course::find($request->course_id);

        if ($blocked = $this->authorizeCourseOwnership($request, $course, 'You are not allowed to announce for this course.')) {
            return $blocked;
        }

        $attachment = null;

        if ($request->hasFile('attachment')) {
            $attachment = $this->uploadFile($request, 'attachment', 'announcements');
        }

        $announcement = Announcement::create([
            'course_id' => $course->id,
            'professor_id' => $request->user()->id,
            'title' => $request->title,
            'body' => $request->body,
            'attachment' => $attachment,
        ]);

        $this->notifyCourseAnnouncement(
            $this->registeredStudentIds($course->id),
            $request->user()->id,
            $course->id,
            $announcement->id,
            $announcement->title,
            $announcement->body
        );

        return SendResponse(201, 'Announcement posted successfully.', $this->format($announcement));
    }

    public function update(ProfessorUpdateAnnouncementRequest $request)
    {
        $announcement = Announcement::find($request->announcement_id);

        if ($announcement->professor_id !== $request->user()->id) {
            return SendResponse(403, 'You are not allowed to edit this announcement.');
        }

        $attachment = $announcement->attachment;

        if ($request->hasFile('attachment')) {
            $attachment = $announcement->attachment
                ? $this->updateFile($announcement->attachment, $request, 'attachment', 'announcements')
                : $this->uploadFile($request, 'attachment', 'announcements');
        }

        $announcement->update([
            'title' => $request->input('title', $announcement->title),
            'body' => $request->input('body', $announcement->body),
            'attachment' => $attachment,
        ]);

        return SendResponse(200, 'Announcement updated successfully.', $this->format($announcement));
    }

    public function delete(Request $request, $id)
    {
        $announcement = Announcement::find($id);

        if (! $announcement) {
            return SendResponse(404, 'Announcement not found.');
        }

        if ($announcement->professor_id !== $request->user()->id) {
            return SendResponse(403, 'You are not allowed to delete this announcement.');
        }

        if ($announcement->attachment) {
            $this->deleteFile($announcement->attachment);
        }

        Notification::where('announcement_id', $announcement->id)->delete();
        $announcement->delete();

        return SendResponse(200, 'Announcement deleted successfully.');
    }

    /**
     * @return array<int, int>
     */
    private function registeredStudentIds(int $courseId): array
    {
        return StudentCourse::where('course_id', $courseId)
            ->registered()
            ->pluck('student_id')
            ->map(fn ($id) => (int) $id)
            ->toArray();
    }

    private function format(Announcement $announcement): array
    {
        return [
            'id' => $announcement->id,
            'course_id' => $announcement->course_id,
            'course_name' => $announcement->course?->course_name,
            'course_code' => $announcement->course?->course_code,
            'author' => $announcement->professor?->name,
            'title' => $announcement->title,
            'body' => $announcement->body,
            'attachment' => $announcement->attachment ? url('uploads/' . $announcement->attachment) : null,
            'created_at' => $announcement->created_at,
            'updated_at' => $announcement->updated_at,
        ];
    }
}
