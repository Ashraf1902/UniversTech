<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\LogsActivity;

class Event extends Model
{
    use HasFactory, LogsActivity;

    protected $table = 'events';

    protected $fillable = [
        'title',
        'content',
        'admin_id',
        'image'
    ];

    public function admin()
    {
        return $this->belongsTo(Admin::class);
    }
}
?>
