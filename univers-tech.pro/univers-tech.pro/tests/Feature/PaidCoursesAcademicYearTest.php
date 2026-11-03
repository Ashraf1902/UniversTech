<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Payment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PaidCoursesAcademicYearTest extends TestCase
{
    use RefreshDatabase;

    private Admin $superAdmin;

    private User $student;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = Admin::factory()->create(['id' => 1, 'is_super_admin' => true]);

        $this->student = User::factory()->create([
            'type' => User::TYPE_STUDENT,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ]);

        Sanctum::actingAs($this->student);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    /** Parse a campus wall-clock time and convert it to the stored app timezone. */
    private function cairo(string $time): Carbon
    {
        return Carbon::parse($time, config('university.timezone'))
            ->setTimezone(config('app.timezone'));
    }

    private function makePayment(array $overrides = []): Payment
    {
        return Payment::forceCreate(array_merge([
            'user_id' => $this->student->id,
            'amount' => 700,
            'type' => Payment::TYPE_COURSES,
            'status' => Payment::STATUS_PAID,
            'created_at' => $this->cairo('2026-10-15 10:00:00'),
            'paid_at' => $this->cairo('2026-10-15 10:00:00'),
        ], $overrides));
    }

    private function nowAt(string $time): void
    {
        Carbon::setTestNow(Carbon::parse($time, config('university.timezone')));
    }

    private function assertUnlocked(): void
    {
        $this->getJson('/api/user/quizzes')->assertOk();
    }

    private function assertLocked(): void
    {
        $this->getJson('/api/user/quizzes')->assertStatus(403);
    }

    public function test_an_october_payment_covers_december_march_and_july(): void
    {
        $this->makePayment();

        foreach (['2026-12-20 12:00:00', '2027-03-10 12:00:00', '2027-07-01 12:00:00'] as $time) {
            $this->nowAt($time);
            $this->assertUnlocked();
        }
    }

    public function test_the_same_payment_stops_counting_on_september_first(): void
    {
        $this->makePayment();

        $this->nowAt('2027-08-31 23:59:00');
        $this->assertUnlocked();

        $this->nowAt('2027-09-01 00:00:00');
        $this->assertLocked();
    }

    public function test_the_boundary_is_cairo_time_not_utc(): void
    {
        // 31 Aug 23:30 Cairo is still 31 Aug in UTC but belongs to the year
        // that ends on 31 August, so it must not unlock September onwards.
        $this->makePayment([
            'created_at' => $this->cairo('2026-08-31 23:30:00'),
            'paid_at' => $this->cairo('2026-08-31 23:30:00'),
        ]);

        $this->nowAt('2026-08-31 23:45:00');
        $this->assertUnlocked();

        $this->nowAt('2026-09-01 00:30:00');
        $this->assertLocked();
    }

    public function test_a_payment_just_after_midnight_cairo_counts_in_the_new_year(): void
    {
        // 1 Sep 00:30 Cairo is 31 Aug 21:30 UTC; a UTC calendar comparison
        // would wrongly place it in the previous academic year.
        $this->makePayment([
            'created_at' => $this->cairo('2026-09-01 00:30:00'),
            'paid_at' => $this->cairo('2026-09-01 00:30:00'),
        ]);

        $this->nowAt('2026-09-01 01:00:00');
        $this->assertUnlocked();
    }

    public function test_paid_at_wins_over_created_at_at_the_boundary(): void
    {
        // Started on 31 August, actually paid on 1 September: it belongs to the
        // new academic year.
        $this->makePayment([
            'created_at' => $this->cairo('2026-08-31 23:30:00'),
            'paid_at' => $this->cairo('2026-09-01 00:30:00'),
        ]);

        $this->nowAt('2026-08-31 23:45:00');
        $this->assertLocked();

        $this->nowAt('2026-09-01 01:00:00');
        $this->assertUnlocked();
    }

    public function test_created_at_is_used_when_paid_at_is_missing(): void
    {
        $this->makePayment([
            'created_at' => $this->cairo('2026-10-15 10:00:00'),
            'paid_at' => null,
        ]);

        $this->nowAt('2026-12-01 12:00:00');
        $this->assertUnlocked();
    }

    public function test_a_payment_from_2024_does_not_unlock_2026(): void
    {
        $this->makePayment([
            'created_at' => $this->cairo('2024-10-15 10:00:00'),
            'paid_at' => $this->cairo('2024-10-15 10:00:00'),
        ]);

        $this->nowAt('2026-11-01 12:00:00');
        $this->assertLocked();
    }

    public function test_a_waived_course_payment_counts(): void
    {
        $this->makePayment(['status' => Payment::STATUS_WAIVED]);

        $this->nowAt('2026-12-01 12:00:00');
        $this->assertUnlocked();
    }

    public function test_a_pending_course_payment_does_not_count(): void
    {
        $this->makePayment(['status' => Payment::STATUS_PENDING]);

        $this->nowAt('2026-12-01 12:00:00');
        $this->assertLocked();
    }
}
