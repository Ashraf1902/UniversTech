<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasFactory;

    public const TYPE_COURSES = 'courses';
    public const TYPE_YEAR = 'year';

    public const STATUS_PENDING = 'pending';
    public const STATUS_PAID = 'paid';
    public const STATUS_FAILED = 'failed';

    public const PRICE_COURSES = 700;
    public const PRICE_YEAR = 575;

    protected $guarded = [];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public static function priceFor(string $type): float
    {
        return $type === self::TYPE_COURSES ? self::PRICE_COURSES : self::PRICE_YEAR;
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}