<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\LogsActivity;

class Payment extends Model
{
    use HasFactory, SoftDeletes, LogsActivity;

    public const TYPE_COURSES = 'courses';
    public const TYPE_YEAR = 'year';

    public const STATUS_PENDING = 'pending';
    public const STATUS_PAID = 'paid';
    public const STATUS_WAIVED = 'waived';
    public const STATUS_REFUNDED = 'refunded';
    public const STATUS_FAILED = 'failed';

    /**
     * Statuses an admin may set through the payment override (A4).
     *
     * @var array<int, string>
     */
    public const OVERRIDE_STATUSES = [
        self::STATUS_PAID,
        self::STATUS_WAIVED,
        self::STATUS_REFUNDED,
    ];

    public const PRICE_COURSES = 700;
    public const PRICE_YEAR = 575;

    /**
     * Mass-assignable fields. `amount` is deliberately excluded so it can only
     * ever be set explicitly server-side (via Payment::priceFor), never from
     * request input.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'user_id',
        'type',
        'status',
        'semester_id',
        'paid_at',
        'receipt_number',
        'payment_intent_id',
        'admin_id',
        'note',
        'waived_at',
        'refunded_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'paid_at' => 'datetime',
        'waived_at' => 'datetime',
        'refunded_at' => 'datetime',
    ];

    public static function priceFor(string $type): float
    {
        return $type === self::TYPE_COURSES ? self::PRICE_COURSES : self::PRICE_YEAR;
    }

    /**
     * Deterministic receipt number derived from the payment id.
     */
    public static function receiptNumber(int $id, mixed $when = null): string
    {
        $year = $when ? (int) date('Y', strtotime((string) $when)) : (int) now()->format('Y');

        return 'RCPT-' . $year . '-' . str_pad((string) $id, 6, '0', STR_PAD_LEFT);
    }

    /**
     * Whether this payment currently grants access to the registered courses.
     */
    public function grantsAccess(): bool
    {
        return in_array($this->status, [self::STATUS_PAID, self::STATUS_WAIVED], true);
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function semester()
    {
        return $this->belongsTo(Semester::class, 'semester_id');
    }

    public function admin()
    {
        return $this->belongsTo(Admin::class, 'admin_id');
    }

    /**
     * Billing fields are audited through an explicit PAYMENT_OVERRIDDEN entry
     * so the automatic updated-entry never duplicates that audit trail.
     *
     * @return array<int, string>
     */
    protected function activityLogIgnoredAttributes(): array
    {
        return ['status', 'admin_id', 'note', 'receipt_number', 'paid_at', 'waived_at', 'refunded_at'];
    }
}
