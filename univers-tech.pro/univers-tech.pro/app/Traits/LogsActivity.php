<?php

namespace App\Traits;

use App\Support\ActivityLogger;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Records created / updated / deleted / restored / force-deleted lifecycle
 * events for a model into the activity log.
 *
 * High-churn or sensitive attributes can be excluded by overriding
 * {@see activityLogIgnoredAttributes()} or {@see activityLogHiddenAttributes()}.
 * When an `updated` event only touches ignored attributes (for example a
 * progress counter) nothing is written, so the log never floods.
 */
trait LogsActivity
{
    public static function bootLogsActivity(): void
    {
        static::created(function (Model $model) {
            $model->writeActivityLog(ActivityLogger::CREATED);
        });

        static::updated(function (Model $model) {
            $model->writeActivityLog(ActivityLogger::UPDATED);
        });

        static::deleted(function (Model $model) {
            $force = method_exists($model, 'isForceDeleting') && $model->isForceDeleting();

            $model->writeActivityLog($force ? ActivityLogger::FORCE_DELETED : ActivityLogger::DELETED);
        });

        if (static::activityLogUsesSoftDeletes()) {
            static::restored(function (Model $model) {
                $model->writeActivityLog(ActivityLogger::RESTORED);
            });
        }
    }

    protected static function activityLogUsesSoftDeletes(): bool
    {
        return in_array(SoftDeletes::class, class_uses_recursive(static::class), true);
    }

    protected static function activityLogEnabled(): bool
    {
        return true;
    }

    /**
     * Attributes always masked before being stored.
     *
     * @return array<int, string>
     */
    protected function activityLogHiddenAttributes(): array
    {
        return ['password', 'remember_token', 'nationalid', 'national_id'];
    }

    /**
     * Attributes that never trigger (or appear in) an activity entry.
     *
     * @return array<int, string>
     */
    protected function activityLogIgnoredAttributes(): array
    {
        return [];
    }

    protected function writeActivityLog(string $action): void
    {
        if (! static::activityLogEnabled()) {
            return;
        }

        $hidden = $this->activityLogHiddenAttributes();
        $ignored = array_filter(array_merge(
            [$this->getCreatedAtColumn(), $this->getUpdatedAtColumn()],
            $this->activityLogIgnoredAttributes()
        ));

        if ($action === ActivityLogger::UPDATED) {
            $changes = collect($this->getChanges())->except($ignored)->all();

            if (empty($changes)) {
                return;
            }

            $properties = [
                'attributes' => $this->maskAttributes($changes, $hidden),
                'old' => $this->maskAttributes(
                    collect($this->getOriginal())->only(array_keys($changes))->all(),
                    $hidden
                ),
            ];
        } else {
            $properties = [
                'attributes' => $this->maskAttributes(
                    collect($this->getAttributes())->except($ignored)->all(),
                    $hidden
                ),
            ];
        }

        ActivityLogger::log($action, $this, $properties);
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<int, string>  $hidden
     * @return array<string, mixed>
     */
    protected function maskAttributes(array $attributes, array $hidden): array
    {
        return collect($attributes)
            ->map(fn ($value, $key) => in_array($key, $hidden, true) ? '***' : $value)
            ->all();
    }
}
