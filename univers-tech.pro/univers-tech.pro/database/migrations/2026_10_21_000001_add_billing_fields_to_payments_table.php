<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('semester_id')->nullable()->after('user_id')->constrained('semesters')->nullOnDelete();
            $table->foreignId('admin_id')->nullable()->after('status')->constrained('admins')->nullOnDelete();
            $table->string('receipt_number')->nullable()->unique()->after('payment_method_id');
            $table->text('note')->nullable()->after('admin_id');
            $table->timestamp('paid_at')->nullable()->after('note');
            $table->timestamp('waived_at')->nullable()->after('paid_at');
            $table->timestamp('refunded_at')->nullable()->after('waived_at');
        });

        // Backfill: already-paid payments get a paid timestamp and a receipt
        // number so historical receipts keep working after the upgrade.
        DB::table('payments')
            ->where('status', 'paid')
            ->whereNull('paid_at')
            ->update(['paid_at' => DB::raw('created_at')]);

        DB::table('payments')
            ->where('status', 'paid')
            ->whereNull('receipt_number')
            ->orderBy('id')
            ->get()
            ->each(function ($payment) {
                DB::table('payments')->where('id', $payment->id)->update([
                    'receipt_number' => 'RCPT-' . date('Y', strtotime((string) $payment->created_at))
                        . '-' . str_pad((string) $payment->id, 6, '0', STR_PAD_LEFT),
                ]);
            });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropUnique(['receipt_number']);
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('semester_id');
            $table->dropConstrainedForeignId('admin_id');
            $table->dropColumn(['receipt_number', 'note', 'paid_at', 'waived_at', 'refunded_at']);
        });
    }
};
