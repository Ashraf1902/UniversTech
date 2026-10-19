<?php

namespace Tests\Feature;

use App\Http\Controllers\API\Student\PaymentController;
use App\Models\Admin;
use App\Models\Course;
use App\Models\Department;
use App\Models\Level;
use App\Models\Payment;
use App\Models\StudentCourse;
use App\Models\User;
use App\Support\Settings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Stripe\Exception\InvalidRequestException;
use Stripe\PaymentIntent;
use Tests\TestCase;

class PaymentTest extends TestCase
{
    use RefreshDatabase;

    private Admin $admin;

    private User $student;

    private User $otherStudent;

    private Course $course;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = Admin::factory()->create(['id' => 1, 'is_super_admin' => true]);
        $department = Department::factory()->create(['id' => 1, 'admin_id' => $this->admin->id]);
        $level = Level::factory()->create(['id' => 1]);

        $this->student = $this->makeStudent($department->id, $level->id);
        $this->otherStudent = $this->makeStudent($department->id, $level->id);

        $this->course = Course::create([
            'course_name' => 'Algorithms',
            'course_code' => 'CS101',
            'no_of_hours' => 3,
            'department_id' => $department->id,
            'admin_id' => $this->admin->id,
        ]);

        StudentCourse::create([
            'student_id' => $this->student->id,
            'course_id' => $this->course->id,
        ]);
    }

    private function makeStudent(int $departmentId, int $levelId): User
    {
        $student = User::factory()->create([
            'type' => User::TYPE_STUDENT,
            'admin_id' => $this->admin->id,
            'department_id' => null,
            'level_id' => null,
        ]);
        $student->student()->create([
            'department_id' => $departmentId,
            'level_id' => $levelId,
            'semester' => 'first',
            'credit_points' => 0,
        ]);

        return $student;
    }

    private function actingAsAdmin(array $roles = [], bool $super = false): Admin
    {
        $admin = $super
            ? Admin::factory()->create(['is_super_admin' => true])
            : Admin::factory()->create(['is_super_admin' => false, 'roles' => $roles]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function paidPayment(User $student, string $status = Payment::STATUS_PAID): Payment
    {
        return Payment::forceCreate([
            'user_id' => $student->id,
            'amount' => Payment::PRICE_COURSES,
            'type' => Payment::TYPE_COURSES,
            'status' => $status,
            'paid_at' => $status === Payment::STATUS_PAID ? now() : null,
        ]);
    }

    public function test_make_payment_records_receipt_and_paid_timestamp(): void
    {
        config(['services.stripe.demo_mode' => true, 'services.stripe.secret' => null]);

        Sanctum::actingAs($this->student);

        $this->postJson('/api/user/make-payment', ['type' => Payment::TYPE_COURSES])
            ->assertOk()
            ->assertJsonPath('data.payment.status', Payment::STATUS_PAID);

        $payment = Payment::where('user_id', $this->student->id)->firstOrFail();

        $this->assertSame(Payment::STATUS_PAID, $payment->status);
        $this->assertNotNull($payment->paid_at);
        $this->assertNotNull($payment->receipt_number);
        $this->assertStringStartsWith('RCPT-', $payment->receipt_number);
    }

    public function test_client_supplied_amount_is_ignored_and_price_comes_from_the_server(): void
    {
        config(['services.stripe.demo_mode' => true, 'services.stripe.secret' => null]);

        Sanctum::actingAs($this->student);

        $this->postJson('/api/user/make-payment', [
            'type' => Payment::TYPE_COURSES,
            'amount' => 1,
        ])->assertOk();

        $payment = Payment::where('user_id', $this->student->id)->firstOrFail();

        $this->assertSame('700.00', (string) $payment->amount);
    }

    public function test_history_only_lists_the_students_own_payments(): void
    {
        $this->paidPayment($this->student);
        $this->paidPayment($this->otherStudent, Payment::STATUS_PENDING);

        Sanctum::actingAs($this->student);

        $response = $this->getJson('/api/user/payments')->assertOk();

        $this->assertCount(1, $response->json('data.data'));
        $response->assertJsonFragment(['status' => Payment::STATUS_PAID]);
    }

    public function test_waived_payment_grants_access_and_refunded_removes_it(): void
    {
        $payment = $this->paidPayment($this->student, Payment::STATUS_WAIVED);

        Sanctum::actingAs($this->student);
        $this->getJson('/api/user/courses')->assertOk();

        $payment->update(['status' => Payment::STATUS_REFUNDED, 'refunded_at' => now()]);
        $this->getJson('/api/user/courses')->assertStatus(403);
    }

    public function test_receipt_requires_a_paid_payment_and_ownership(): void
    {
        $pending = Payment::forceCreate([
            'user_id' => $this->student->id,
            'amount' => Payment::PRICE_COURSES,
            'type' => Payment::TYPE_COURSES,
            'status' => Payment::STATUS_PENDING,
        ]);
        $paid = $this->paidPayment($this->student);
        $other = $this->paidPayment($this->otherStudent);

        Sanctum::actingAs($this->student);

        $this->getJson('/api/user/payment/' . $pending->id . '/receipt')->assertStatus(422);
        $this->getJson('/api/user/payment/' . $other->id . '/receipt')->assertStatus(404);
        $this->getJson('/api/user/payment/' . $paid->id . '/receipt')
            ->assertOk()
            ->assertJsonPath('data.amount', '700.00');
    }

    public function test_admin_listing_requires_the_payments_scope(): void
    {
        $this->actingAsAdmin(['courses']);
        $this->getJson('/api/payment/get/all')->assertStatus(403);

        $this->actingAsAdmin(['payments']);
        $this->getJson('/api/payment/get/all')->assertOk();
    }

    public function test_override_requires_a_reason(): void
    {
        $payment = $this->paidPayment($this->student, Payment::STATUS_PENDING);

        $this->actingAsAdmin(['payments']);
        $this->postJson('/api/payment/override', [
            'payment_id' => $payment->id,
            'status' => Payment::STATUS_PAID,
        ])->assertStatus(422);
    }

    public function test_admin_can_mark_payment_paid_with_audit_and_notification(): void
    {
        $payment = $this->paidPayment($this->student, Payment::STATUS_PENDING);

        $admin = $this->actingAsAdmin(['payments']);

        $this->postJson('/api/payment/override', [
            'payment_id' => $payment->id,
            'status' => Payment::STATUS_PAID,
            'reason' => 'Cash paid at the office',
        ])->assertOk();

        $payment->refresh();

        $this->assertSame(Payment::STATUS_PAID, $payment->status);
        $this->assertSame($admin->id, $payment->admin_id);
        $this->assertSame('Cash paid at the office', $payment->note);
        $this->assertNotNull($payment->paid_at);
        $this->assertNotNull($payment->receipt_number);

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'payment_overridden',
            'subject_id' => $payment->id,
        ]);
        $this->assertDatabaseHas('notifications', ['student_id' => $this->student->id]);
    }

    public function test_admin_can_refund_a_payment_and_access_is_removed(): void
    {
        $payment = $this->paidPayment($this->student);

        $this->actingAsAdmin(['payments']);
        $this->postJson('/api/payment/override', [
            'payment_id' => $payment->id,
            'status' => Payment::STATUS_REFUNDED,
            'reason' => 'Duplicate charge',
        ])->assertOk();

        $this->assertSame(Payment::STATUS_REFUNDED, $payment->fresh()->status);
        $this->assertNotNull($payment->fresh()->refunded_at);

        Sanctum::actingAs($this->student);
        $this->getJson('/api/user/courses')->assertStatus(403);
    }

    public function test_dropping_a_course_flags_a_refund_for_admin_review(): void
    {
        $this->paidPayment($this->student);

        Sanctum::actingAs($this->student);
        $this->postJson('/api/user/drop-course', ['course_id' => $this->course->id])->assertOk();

        $this->assertDatabaseHas('notifications', ['admin_id' => $this->admin->id]);
        $this->assertDatabaseHas('activity_logs', ['action' => 'payment_refund_requested']);

        Settings::set('flag_refund_on_drop', 0);
        $this->assertFalse(Settings::flagRefundOnDrop());
    }

    public function test_amount_is_not_mass_assignable(): void
    {
        $payment = new Payment();

        $payment->fill([
            'user_id' => $this->student->id,
            'type' => Payment::TYPE_COURSES,
            'amount' => 9999,
        ]);

        $this->assertArrayNotHasKey('amount', $payment->getAttributes());
        $this->assertSame(Payment::TYPE_COURSES, $payment->type);
    }

    public function test_provider_errors_are_logged_server_side_and_not_leaked_to_the_client(): void
    {
        config([
            'services.stripe.demo_mode' => true,
            'services.stripe.secret' => 'sk_test_placeholder',
        ]);

        $controller = Mockery::mock(PaymentController::class)->makePartial();
        $controller->shouldAllowMockingProtectedMethods();
        $controller->shouldReceive('createPaymentIntent')
            ->andThrow(new InvalidRequestException('secret provider detail'));
        $this->app->instance(PaymentController::class, $controller);

        Log::spy();

        Sanctum::actingAs($this->student);

        $response = $this->postJson('/api/user/make-payment', ['type' => Payment::TYPE_COURSES]);

        $response->assertStatus(400)
            ->assertJsonPath('message', 'We could not process your payment. Please try again.');

        $this->assertStringNotContainsString('secret provider detail', $response->getContent());

        $this->assertSame(
            Payment::STATUS_FAILED,
            Payment::where('user_id', $this->student->id)->firstOrFail()->status
        );

        Log::shouldHaveReceived('error')
            ->once()
            ->withArgs(function ($message, $context = []) {
                return $message === 'Payment provider error'
                    && ($context['exception'] ?? null) === InvalidRequestException::class
                    && ($context['message'] ?? null) === 'secret provider detail';
            });
    }

    public function test_demo_mode_pays_without_a_gateway_call_even_in_production(): void
    {
        $this->app['env'] = 'production';

        config(['services.stripe.demo_mode' => true, 'services.stripe.secret' => null]);

        $controller = Mockery::mock(PaymentController::class)->makePartial();
        $controller->shouldAllowMockingProtectedMethods();
        $controller->shouldReceive('createPaymentIntent')->never();
        $this->app->instance(PaymentController::class, $controller);

        Sanctum::actingAs($this->student);

        $this->postJson('/api/user/make-payment', ['type' => Payment::TYPE_COURSES])
            ->assertOk()
            ->assertJsonPath('data.payment.status', Payment::STATUS_PAID);

        $payment = Payment::where('user_id', $this->student->id)->firstOrFail();

        $this->assertSame(Payment::STATUS_PAID, $payment->status);
        $this->assertSame('700.00', (string) $payment->amount);
        $this->assertNotNull($payment->receipt_number);
    }

    public function test_an_existing_secret_overrides_the_demo_flag_and_uses_the_gateway(): void
    {
        config(['services.stripe.demo_mode' => true, 'services.stripe.secret' => 'sk_test_dummy']);

        $controller = Mockery::mock(PaymentController::class)->makePartial();
        $controller->shouldAllowMockingProtectedMethods();
        $controller->shouldReceive('createPaymentIntent')
            ->once()
            ->andReturn(PaymentIntent::constructFrom(['id' => 'pi_demo_off', 'client_secret' => 'cs_demo_off']));
        $this->app->instance(PaymentController::class, $controller);

        Sanctum::actingAs($this->student);

        $this->postJson('/api/user/make-payment', ['type' => Payment::TYPE_COURSES])
            ->assertOk()
            ->assertJsonPath('data.payment.status', Payment::STATUS_PENDING)
            ->assertJsonPath('data.client_secret', 'cs_demo_off');
    }

    public function test_configured_gateway_without_the_demo_flag_uses_the_gateway(): void
    {
        config(['services.stripe.demo_mode' => false, 'services.stripe.secret' => 'sk_test_dummy']);

        $controller = Mockery::mock(PaymentController::class)->makePartial();
        $controller->shouldAllowMockingProtectedMethods();
        $controller->shouldReceive('createPaymentIntent')
            ->once()
            ->andReturn(PaymentIntent::constructFrom(['id' => 'pi_live', 'client_secret' => 'cs_live']));
        $this->app->instance(PaymentController::class, $controller);

        Sanctum::actingAs($this->student);

        $this->postJson('/api/user/make-payment', ['type' => Payment::TYPE_COURSES])
            ->assertOk()
            ->assertJsonPath('data.payment.status', Payment::STATUS_PENDING)
            ->assertJsonPath('data.client_secret', 'cs_live');
    }

    public function test_neither_demo_nor_configured_returns_the_clear_message_and_writes_nothing(): void
    {
        config(['services.stripe.demo_mode' => false, 'services.stripe.secret' => null]);

        Sanctum::actingAs($this->student);

        $this->postJson('/api/user/make-payment', ['type' => Payment::TYPE_COURSES])
            ->assertStatus(503)
            ->assertJsonPath('message', 'Payments are not configured in this environment.');

        $this->assertDatabaseMissing('payments', ['user_id' => $this->student->id]);
    }

    public function test_an_unset_demo_flag_without_a_secret_returns_the_clear_message_and_writes_nothing(): void
    {
        config(['services.stripe.demo_mode' => null, 'services.stripe.secret' => null]);

        Sanctum::actingAs($this->student);

        $this->postJson('/api/user/make-payment', ['type' => Payment::TYPE_COURSES])
            ->assertStatus(503)
            ->assertJsonPath('message', 'Payments are not configured in this environment.');

        $this->assertDatabaseMissing('payments', ['user_id' => $this->student->id]);
    }
}
