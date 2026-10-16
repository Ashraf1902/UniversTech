<?php

namespace App\Traits;

use App\Jobs\FanOutNotification;
use App\Models\Admin;
use App\Models\Notification;
use App\Models\User;

trait Notifiable
{
    /**
     * High-signal notification sent to every admin (e.g. a grade changed after
     * publication/lock). Routed through this trait per Stage 2.
     */
    protected function notifyAllAdmins(string $title, string $content): void
    {
        $adminIds = Admin::query()->pluck('id');

        if ($adminIds->isEmpty()) {
            return;
        }

        FanOutNotification::dispatch(
            $adminIds->map(fn (int $id) => [
                'admin_id' => $id,
                'title' => $title,
                'content' => $content,
                'type' => Notification::TYPE_NOTIFICATION,
                'created_at' => now(),
                'updated_at' => now(),
            ])->toArray()
        );
    }

    /**
     * Notify the admin who created the current record about an action.
     */
    protected function notifyAdmin(string $title, string $content, ?int $adminId = null): void
    {
        $actor = request()->user();

        // notifications.admin_id references the admins table, so only an actual
        // administrator id may be written there. Professors, students and public
        // applicants are User models, so fall back to notifying every admin
        // instead of violating the foreign key.
        $adminId = $adminId ?? ($actor instanceof Admin ? $actor->id : null);

        if ($adminId === null) {
            $this->notifyAllAdmins($title, $content);

            return;
        }

        Notification::create([
            'title' => $title,
            'content' => $content,
            'admin_id' => $adminId,
            'type' => Notification::TYPE_NOTIFICATION,
        ]);
    }

    /**
     * Notify a specific student.
     */
    protected function notifyStudent(int $studentId, string $title, string $content, ?int $professorId = null): void
    {
        Notification::create([
            'student_id' => $studentId,
            'professor_id' => $professorId,
            'title' => $title,
            'content' => $content,
            'type' => Notification::TYPE_NOTIFICATION,
        ]);
    }

    /**
     * Notify a professor (e.g. about a student submission).
     */
    protected function notifyProfessor(int $professorId, string $title, string $content, ?int $studentId = null): void
    {
        if (! $professorId) {
            return;
        }

        Notification::create([
            'student_id' => $studentId,
            'professor_id' => $professorId,
            'title' => $title,
            'content' => $content,
            'type' => Notification::TYPE_NOTIFICATION,
        ]);
    }

    /**
     * Notify all students (used for events and announcements).
     */
    protected function notifyAllStudents(string $title, string $content, ?int $adminId = null): void
    {
        $studentIds = User::where('type', User::TYPE_STUDENT)->pluck('id');
        $adminId = $adminId ?? request()->user()?->id;

        if ($studentIds->isEmpty()) {
            return;
        }

        FanOutNotification::dispatch(
            $studentIds->map(fn (int $id) => [
                'student_id' => $id,
                'title' => $title,
                'content' => $content,
                'admin_id' => $adminId,
                'type' => Notification::TYPE_EVENT,
                'created_at' => now(),
                'updated_at' => now(),
            ])->toArray()
        );
    }

    /**
     * Notify a specific set of students about an event (type=EVENT).
     *
     * @param  array<int, int>  $studentIds
     */
    protected function notifyEventToStudents(array $studentIds, string $title, string $content, ?int $adminId = null): void
    {
        $studentIds = array_values(array_unique(array_map('intval', $studentIds)));

        if (empty($studentIds)) {
            return;
        }

        $adminId = $adminId ?? request()->user()?->id;

        FanOutNotification::dispatch(
            array_map(fn (int $id) => [
                'student_id' => $id,
                'title' => $title,
                'content' => $content,
                'admin_id' => $adminId,
                'type' => Notification::TYPE_EVENT,
                'created_at' => now(),
                'updated_at' => now(),
            ], $studentIds)
        );
    }

    /**
     * Fan out a course announcement to the given students.
     *
     * @param  array<int, int>  $studentIds
     */
    protected function notifyCourseAnnouncement(array $studentIds, int $professorId, int $courseId, int $announcementId, string $title, string $content): void
    {
        $studentIds = array_values(array_unique(array_map('intval', $studentIds)));

        if (empty($studentIds)) {
            return;
        }

        FanOutNotification::dispatch(
            array_map(fn (int $id) => [
                'student_id' => $id,
                'professor_id' => $professorId,
                'course_id' => $courseId,
                'announcement_id' => $announcementId,
                'category' => Notification::CATEGORY_ANNOUNCEMENT,
                'title' => $title,
                'content' => $content,
                'type' => Notification::TYPE_NOTIFICATION,
                'created_at' => now(),
                'updated_at' => now(),
            ], $studentIds)
        );
    }

    /**
     * Notify multiple students about an event (type=EVENT).
     */
    protected function notifyStudents(array $studentIds, string $title, string $content, ?int $professorId = null): void
    {
        if (empty($studentIds)) {
            return;
        }

        FanOutNotification::dispatch(
            array_map(fn (int $id) => [
                'student_id' => $id,
                'professor_id' => $professorId,
                'title' => $title,
                'content' => $content,
                'type' => Notification::TYPE_NOTIFICATION,
                'created_at' => now(),
                'updated_at' => now(),
            ], $studentIds)
        );
    }
}