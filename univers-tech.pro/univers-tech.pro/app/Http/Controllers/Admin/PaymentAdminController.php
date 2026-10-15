<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Support\ActivityLogger;
use App\Traits\Notifiable;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PaymentAdminController extends Controller
{
    use Notifiable;

    /**
     * List payments for the admin (payments scope, A4).
     */
    public function index(Request $request)
    {
        $request->validate([
            'status' => ['nullable', Rule::in([
                Payment::STATUS_PENDING,
                Payment::STATUS_PAID,
                Payment::STATUS_WAIVED,
                Payment::STATUS_REFUNDED,
                Payment::STATUS_FAILED,
            ])],
            'type' => ['nullable', Rule::in([Payment::TYPE_COURSES, Payment::TYPE_YEAR])],
            'student_id' => 'nullable|integer|exists:users,id',
            'search' => 'nullable|string',
            'deleted' => 'nullable|boolean',
        ]);

        $payments = ($request->boolean('deleted') ? Payment::onlyTrashed() : Payment::query())
            ->with(['user', 'semester', 'admin'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->type))
            ->when($request->filled('student_id'), fn ($q) => $q->where('user_id', $request->student_id))
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = $request->search;
                $q->whereHas('user', fn ($u) => $u->where('name', 'like', "%{$term}%")->orWhere('email', 'like', "%{$term}%"));
            })
            ->orderByDesc('created_at')
            ->paginate(15)
            ->through(fn (Payment $payment) => $this->formatPayment($payment));

        return SendResponse(200, 'Payments fetched successfully.', $payments);
    }

    /**
     * Override a payment's status (A4). Records the acting admin, a mandatory
     * reason, an audit entry and notifies the student.
     */
    public function override(Request $request)
    {
        $data = $request->validate([
            'payment_id' => 'required|integer|exists:payments,id',
            'status' => ['required', Rule::in(Payment::OVERRIDE_STATUSES)],
            'reason' => 'required|string|min:3|max:1000',
        ]);

        $payment = Payment::findOrFail($data['payment_id']);
        $previous = $payment->status;

        $updates = [
            'status' => $data['status'],
            'admin_id' => $request->user()->id,
            'note' => $data['reason'],
        ];

        if ($data['status'] === Payment::STATUS_PAID) {
            $updates['paid_at'] = $payment->paid_at ?? now();
            $updates['refunded_at'] = null;
        } elseif ($data['status'] === Payment::STATUS_WAIVED) {
            $updates['waived_at'] = now();
            $updates['refunded_at'] = null;
        } elseif ($data['status'] === Payment::STATUS_REFUNDED) {
            $updates['refunded_at'] = now();
        }

        if (in_array($data['status'], [Payment::STATUS_PAID, Payment::STATUS_WAIVED], true) && ! $payment->receipt_number) {
            $updates['receipt_number'] = Payment::receiptNumber($payment->id, now());
        }

        $payment->update($updates);

        ActivityLogger::log(
            ActivityLogger::PAYMENT_OVERRIDDEN,
            $payment,
            [
                'from' => $previous,
                'to' => $data['status'],
                'reason' => $data['reason'],
                'admin_id' => $request->user()->id,
            ],
            $request->user(),
            'Payment marked as ' . $data['status'] . ' by admin.'
        );

        $this->notifyStudent(
            $payment->user_id,
            'Payment updated',
            'Your ' . $payment->type . ' payment was marked as ' . $data['status'] . '. Reason: ' . $data['reason']
        );

        return SendResponse(200, 'Payment updated successfully.', $this->formatPayment($payment->fresh(['user', 'semester', 'admin'])));
    }

    private function formatPayment(Payment $payment): array
    {
        return [
            'id' => $payment->id,
            'type' => $payment->type,
            'amount' => $payment->amount,
            'status' => $payment->status,
            'receipt_number' => $payment->receipt_number,
            'note' => $payment->note,
            'paid_at' => $payment->paid_at,
            'waived_at' => $payment->waived_at,
            'refunded_at' => $payment->refunded_at,
            'student' => $payment->user?->name,
            'student_id' => $payment->user_id,
            'overridden_by' => $payment->admin?->name,
            'semester' => $payment->semester ? [
                'id' => $payment->semester->id,
                'name' => $payment->semester->name,
                'academic_year' => $payment->semester->academic_year,
            ] : null,
            'created_at' => $payment->created_at,
        ];
    }
}
