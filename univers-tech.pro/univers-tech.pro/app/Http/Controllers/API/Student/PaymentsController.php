<?php

namespace App\Http\Controllers\API\Student;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\StudentCourse;
use Illuminate\Http\Request;

class PaymentsController extends Controller
{
    /**
     * The authenticated student's payment history (S4).
     */
    public function index(Request $request)
    {
        $payments = auth()->user()->payments()
            ->with('semester')
            ->latest()
            ->paginate(15)
            ->through(fn (Payment $payment) => $this->formatPayment($payment));

        return SendResponse(200, 'Payments fetched successfully.', $payments);
    }

    /**
     * A printable receipt for one of the student's own paid/waived payments.
     */
    public function receipt(Request $request, $id)
    {
        $payment = auth()->user()->payments()->with('semester')->find($id);

        if (! $payment) {
            return SendResponse(404, 'Payment not found.');
        }

        if (! $payment->grantsAccess()) {
            return SendResponse(422, 'A receipt is only available for paid or waived payments.');
        }

        $student = auth()->user();
        $issuedAt = $payment->paid_at ?? $payment->waived_at ?? $payment->created_at;

        $coursesCount = StudentCourse::where('student_id', $student->id)
            ->registered()
            ->count();

        return SendResponse(200, 'Receipt fetched successfully.', [
            'receipt_number' => $payment->receipt_number ?? Payment::receiptNumber($payment->id, $issuedAt),
            'issued_at' => $issuedAt,
            'student' => [
                'name' => $student->name,
                'email' => $student->email,
            ],
            'type' => $payment->type,
            'amount' => $payment->amount,
            'status' => $payment->status,
            'semester' => $payment->semester ? [
                'id' => $payment->semester->id,
                'name' => $payment->semester->name,
                'academic_year' => $payment->semester->academic_year,
            ] : null,
            'courses_count' => $coursesCount,
            'line_items' => [[
                'label' => $payment->type === Payment::TYPE_COURSES ? 'Course access subscription' : 'Annual subscription',
                'amount' => $payment->amount,
            ]],
        ]);
    }

    private function formatPayment(Payment $payment): array
    {
        return [
            'id' => $payment->id,
            'type' => $payment->type,
            'amount' => $payment->amount,
            'status' => $payment->status,
            'receipt_number' => $payment->receipt_number,
            'paid_at' => $payment->paid_at,
            'refunded_at' => $payment->refunded_at,
            'note' => $payment->note,
            'has_receipt' => $payment->grantsAccess(),
            'semester' => $payment->semester ? [
                'id' => $payment->semester->id,
                'name' => $payment->semester->name,
                'academic_year' => $payment->semester->academic_year,
            ] : null,
            'created_at' => $payment->created_at,
        ];
    }
}
