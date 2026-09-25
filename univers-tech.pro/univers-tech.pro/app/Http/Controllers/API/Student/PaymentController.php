<?php

namespace App\Http\Controllers\API\Student;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Traits\Notifiable;
use Illuminate\Http\Request;
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

        $payment = Payment::create([
            'user_id' => auth()->id(),
            'amount' => Payment::priceFor($type),
            'type' => $type,
            'status' => Payment::STATUS_PAID,
        ]);

        $this->notifyAdmin(
            'New payment received',
            auth()->user()->name . ' paid ' . number_format($payment->amount, 2) . ' for ' . $payment->type . '.'
        );

        if (config('services.stripe.demo_mode') || ! config('services.stripe.secret')) {
            return SendResponse(200, 'Payment successful (demo mode).', [
                'payment' => $this->formatPayment($payment),
            ]);
        }

        try {
            $stripe = new StripeClient(config('services.stripe.secret'));

            $intent = $stripe->paymentIntents->create([
                'amount' => (int) round($payment->amount * 100),
                'currency' => config('services.stripe.currency', 'usd'),
                'metadata' => [
                    'user_id' => $payment->user_id,
                    'payment_id' => $payment->id,
                ],
            ]);

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

            return SendResponse(400, 'Payment failed: ' . $e->getMessage());
        } catch (\Exception $e) {
            $payment->update(['status' => Payment::STATUS_FAILED]);

            return SendResponse(500, 'An unexpected error occurred while processing your payment.');
        }
    }

    private function formatPayment(Payment $payment): array
    {
        return [
            'id' => $payment->id,
            'amount' => $payment->amount,
            'type' => $payment->type,
            'status' => $payment->status,
            'created_at' => $payment->created_at,
        ];
    }
}
