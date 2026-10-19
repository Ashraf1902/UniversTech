<?php

namespace App\Http\Controllers\API\Student;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Semester;
use App\Traits\Notifiable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Stripe\Exception\ApiErrorException;
use Stripe\Exception\StripeException;
use Stripe\StripeClient;

class PaymentController extends Controller
{
    use Notifiable;

    public function __invoke(Request $request)
    {
        $request->validate([
            'type' => ['required', Rule::in([Payment::TYPE_COURSES, Payment::TYPE_YEAR])],
        ]);

        $type = $request->input('type');

        $demoMode = config('services.stripe.demo_mode') && ! config('services.stripe.secret');

        if (app()->isProduction() && $demoMode) {
            return SendResponse(503, 'Payments are not configured in this environment.');
        }

        $payment = DB::transaction(function () use ($type) {
            // The amount is derived server-side and assigned directly (never via
            // mass assignment) so a client can never influence what is charged.
            $created = new Payment([
                'user_id' => auth()->id(),
                'type' => $type,
                'status' => Payment::STATUS_PAID,
                'semester_id' => Semester::where('is_active', true)->value('id'),
                'paid_at' => now(),
            ]);
            $created->amount = Payment::priceFor($type);
            $created->save();

            $created->update([
                'receipt_number' => Payment::receiptNumber($created->id, $created->paid_at),
            ]);

            $this->notifyAdmin(
                'New payment received',
                auth()->user()->name . ' paid ' . number_format($created->amount, 2) . ' for ' . $created->type . '.'
            );

            return $created;
        });

        if ($demoMode) {
            return SendResponse(200, 'Payment successful (demo mode).', [
                'payment' => $this->formatPayment($payment),
            ]);
        }

        try {
            $intent = $this->createPaymentIntent($payment);

            $payment->update([
                'payment_intent_id' => $intent->id,
                'status' => Payment::STATUS_PENDING,
            ]);

            return SendResponse(200, 'Payment initiated.', [
                'client_secret' => $intent->client_secret,
                'payment' => $this->formatPayment($payment),
            ]);
        } catch (ApiErrorException $e) {
            $payment->update(['status' => Payment::STATUS_FAILED]);

            Log::error('Payment provider error', [
                'exception' => $e::class,
                'message' => $e->getMessage(),
            ]);

            return SendResponse(400, 'We could not process your payment. Please try again.');
        } catch (\Exception $e) {
            $payment->update(['status' => Payment::STATUS_FAILED]);

            Log::error('Payment processing error', [
                'exception' => $e::class,
                'message' => $e->getMessage(),
            ]);

            return SendResponse(500, 'An unexpected error occurred while processing your payment.');
        }
    }

    protected function createPaymentIntent(Payment $payment)
    {
        $stripe = new StripeClient(config('services.stripe.secret'));

        return $stripe->paymentIntents->create([
            'amount' => (int) round($payment->amount * 100),
            'currency' => config('services.stripe.currency', 'usd'),
            'metadata' => [
                'user_id' => $payment->user_id,
                'payment_id' => $payment->id,
            ],
        ]);
    }

    private function formatPayment(Payment $payment): array
    {
        return [
            'id' => $payment->id,
            'amount' => $payment->amount,
            'type' => $payment->type,
            'status' => $payment->status,
            'receipt_number' => $payment->receipt_number,
            'paid_at' => $payment->paid_at,
            'semester_id' => $payment->semester_id,
            'created_at' => $payment->created_at,
        ];
    }
}
