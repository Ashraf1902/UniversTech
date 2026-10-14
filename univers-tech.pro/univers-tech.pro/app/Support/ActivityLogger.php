<?php

namespace App\Support;

use App\Jobs\RecordActivityLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Central entry point for writing audit-log entries.
 *
 * The actor, ip address and user agent are resolved synchronously (while the
 * HTTP request context is still available) and the row is handed to a queued
 * job so writing the log never slows down the request.
 */
class ActivityLogger
{
    // Model lifecycle
    public const CREATED = 'created';
    public const UPDATED = 'updated';
    public const DELETED = 'deleted';
    public const RESTORED = 'restored';
    public const FORCE_DELETED = 'force_deleted';

    // Authentication
    public const LOGIN = 'login';
    public const LOGIN_FAILED = 'login_failed';
    public const LOGOUT = 'logout';

    // Accounts / access
    public const STATUS_CHANGED = 'status_changed';
    public const ACCESS_REQUEST_ACCEPTED = 'access_request_accepted';
    public const ACCESS_REQUEST_REFUSED = 'access_request_refused';

    // Credentials
    public const PASSWORD_RESET = 'password_reset';
    public const PASSWORD_CHANGED = 'password_changed';

    // Enrollment
    public const ENROLLMENT_STATUS_CHANGED = 'enrollment_status_changed';

    // Grade lifecycle
    public const GRADE_PUBLISHED = 'grade_published';
    public const GRADE_LOCKED = 'grade_locked';
    public const GRADE_UNLOCKED = 'grade_unlocked';
    public const GRADE_OVERRIDDEN = 'grade_overridden';
    public const GRADE_COMPONENTS_UPDATED = 'grade_components_updated';

    // Grade appeals
    public const GRADE_APPEAL_SUBMITTED = 'grade_appeal_submitted';
    public const GRADE_APPEAL_RESOLVED = 'grade_appeal_resolved';

    // Configuration
    public const SETTINGS_UPDATED = 'settings_updated';

    // Administration
    public const ADMIN_CREATED = 'admin_created';
    public const ADMIN_UPDATED = 'admin_updated';
    public const ADMIN_DELETED = 'admin_deleted';
    public const AI_OVERRIDE = 'ai_override';

    /**
     * @param  array<string, mixed>  $properties
     */
    public static function log(
        string $action,
        ?Model $subject = null,
        array $properties = [],
        ?Model $actor = null,
        ?string $description = null
    ): void {
        $actor = $actor ?? static::currentActor();

        $row = [
            'actor_type' => $actor ? $actor->getMorphClass() : null,
            'actor_id' => $actor?->getKey(),
            'subject_type' => $subject ? $subject->getMorphClass() : null,
            'subject_id' => $subject?->getKey(),
            'action' => $action,
            'description' => $description,
            'properties' => empty($properties)
                ? null
                : json_encode($properties, JSON_UNESCAPED_UNICODE),
            'ip_address' => request()?->ip(),
            'user_agent' => static::truncateUserAgent(),
            'created_at' => now(),
        ];

        RecordActivityLog::dispatch($row);
    }

    protected static function currentActor(): ?Model
    {
        $user = request()?->user();

        return $user instanceof Model ? $user : null;
    }

    protected static function truncateUserAgent(): ?string
    {
        $agent = request()?->userAgent();

        return $agent ? Str::limit($agent, 500, '') : null;
    }
}
