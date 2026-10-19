<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use App\Traits\LogsActivity;

class Semester extends Model
{
    use HasFactory, LogsActivity;

    protected $guarded = [];

    protected $casts = [
        'is_active' => 'boolean',
        'registration_opens_at' => 'datetime',
        'registration_closes_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    public function studentPromotions()
    {
        return $this->hasMany(StudentPromotion::class, 'from_semester_id');
    }

    public function isClosed(): bool
    {
        return $this->closed_at !== null;
    }

    /**
     * How many semesters are currently flagged active.
     *
     * The schema cannot enforce "at most one active semester" with a plain
     * unique index because every inactive row would collide on the same
     * value, so this invariant is maintained in application code and
     * guarded by tests.
     */
    public static function activeCount(): int
    {
        return static::query()->where('is_active', true)->count();
    }

    /**
     * Activate this semester as the single active one.
     *
     * Deactivating every other semester and activating this one happen in a
     * single transaction so two active semesters can never be observed, even
     * for a moment or under concurrent admin requests.
     */
    public function activate(): void
    {
        DB::transaction(function () {
            static::query()
                ->where('id', '!=', $this->getKey())
                ->update(['is_active' => false]);

            $this->forceFill(['is_active' => true])->save();
        });
    }

    public function courses()
    {
        return $this->hasMany(Course::class);
    }

    public function schedules()
    {
        return $this->hasMany(Schedule::class);
    }

    /**
     * Whether course registration is currently allowed for this semester.
     *
     * A missing window means "always open" so existing data keeps working.
     */
    public function registrationOpen(): bool
    {
        if (! $this->is_active) {
            return false;
        }

        $now = now();

        if ($this->registration_opens_at && $now->lt($this->registration_opens_at)) {
            return false;
        }

        if ($this->registration_closes_at && $now->gt($this->registration_closes_at)) {
            return false;
        }

        return true;
    }
}
