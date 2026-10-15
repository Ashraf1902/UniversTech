<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Course;
use App\Models\Department;
use App\Models\Level;
use App\Models\Payment;
use App\Models\StudentCourse;
use App\Models\User;
use App\Support\Settings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
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
        return Payment::create([
            'user_id' => $student->id,
            'amount' => Payment::PRICE_COURSES,
            'type' => Payment::TYPE_COURSES,
            'status' => $status,
            'paid_at' => $status === Payment::STATUS_PAID ? now() : null,
        ]);
    }

    public function test_make_payment_records_receipt_and_paid_timestamp(): void
    {
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
        $pending = Payment::create([
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
}
