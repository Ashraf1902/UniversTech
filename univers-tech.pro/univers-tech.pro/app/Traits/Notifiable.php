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
        Notification::create([
            'title' => $title,
            'content' => $content,
            'admin_id' => $adminId ?? request()->user()?->id,
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