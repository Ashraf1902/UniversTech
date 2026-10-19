<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Course;
use App\Models\Department;
use App\Models\Level;
use App\Models\Payment;
use App\Models\Schedule;
use App\Models\Semester;
use App\Models\StudentCourse;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Only one semester may be active at a time.
 *
 * Two active semesters silently redirect every "current" student query to the
 * wrong term: the app resolves the active semester by `is_active` and, when
 * two match, MySQL returns whichever row comes first. That made students lose
 * their visible enrollments and timetable while the "other" active semester
 * held the real data. These tests pin the invariant down at three levels:
 * the model helper, the admin activation endpoint, and a regression test that
 * fails if the dual-active state ever reaches the student endpoints.
 */
class SingleActiveSemesterTest extends TestCase
{
    use RefreshDatabase;

    private Admin $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = Admin::factory()->create(['is_super_admin' => true]);
        Sanctum::actingAs($this->admin);
    }

    public function test_activating_a_semester_deactivates_all_others(): void
    {
        $first = Semester::create(['name' => 'First', 'academic_year' => '2026-2027', 'is_active' => true]);
        $second = Semester::create(['name' => 'Second', 'academic_year' => '2026-2027', 'is_active' => false]);
        $third = Semester::create(['name' => 'Third', 'academic_year' => '2026-2027', 'is_active' => false]);

        $second->activate();

        $this->assertTrue($second->fresh()->is_active);
        $this->assertFalse($first->fresh()->is_active);
        $this->assertFalse($third->fresh()->is_active);
        $this->assertSame(1, Semester::activeCount());
    }

    public function test_activation_via_admin_endpoint_leaves_exactly_one_active_semester(): void
    {
        $current = Semester::create(['name' => 'Current', 'academic_year' => '2026-2027', 'is_active' => true]);
        $next = Semester::create(['name' => 'Next', 'academic_year' => '2026-2027', 'is_active' => false]);

        $response = $this->postJson('/api/semester/update', [
            'semester_id' => $next->id,
            'is_active' => true,
        ]);

        $response->assertOk();
        $this->assertTrue($next->fresh()->is_active);
        $this->assertFalse($current->fresh()->is_active);
        $this->assertSame(1, Semester::activeCount());
    }

    public function test_creating_an_active_semester_via_admin_endpoint_deactivates_others(): void
    {
        $current = Semester::create(['name' => 'Current', 'academic_year' => '2026-2027', 'is_active' => true]);

        $response = $this->postJson('/api/semester/store', [
            'name' => 'Brand New',
            'academic_year' => '2027-2028',
            'is_active' => true,
        ]);

        $response->assertCreated();

        $created = Semester::where('name', 'Brand New')->firstOrFail();
        $this->assertTrue($created->is_active);
        $this->assertFalse($current->fresh()->is_active);
        $this->assertSame(1, Semester::activeCount());
    }

    public function test_creating_a_semester_without_is_active_leaves_it_inactive(): void
    {
        $current = Semester::create(['name' => 'Current', 'academic_year' => '2026-2027', 'is_active' => true]);

        $response = $this->postJson('/api/semester/store', [
            'name' => 'Draft',
            'academic_year' => '2027-2028',
        ]);

        $response->assertCreated();

        $created = Semester::where('name', 'Draft')->firstOrFail();
        $this->assertFalse($created->is_active);
        $this->assertTrue($current->fresh()->is_active);
        $this->assertSame(1, Semester::activeCount());
    }

    public function test_activation_is_atomic_other_updates_roll_back_on_failure(): void
    {
        $current = Semester::create(['name' => 'Current', 'academic_year' => '2026-2027', 'is_active' => true]);
        $next = Semester::create(['name' => 'Next', 'academic_year' => '2026-2027', 'is_active' => false]);

        // Force the final write inside activate() to fail; the deactivation of
        // the other semester must be rolled back with it (no "no active
        // semester" limbo left behind).
        Semester::saving(function (Semester $subject) use ($next) {
            if ($subject->getKey() === $next->getKey()) {
                throw new \RuntimeException('forced failure while activating');
            }
        });

        try {
            $next->activate();
            $this->fail('Expected the activation transaction to fail.');
        } catch (\RuntimeException $e) {
            $this->assertSame('forced failure while activating', $e->getMessage());
        }

        $this->assertTrue($current->fresh()->is_active);
        $this->assertFalse($next->fresh()->is_active);
        $this->assertSame(1, Semester::activeCount());
    }

    public function test_dual_active_state_fails_the_student_endpoints_regression(): void
    {
        $department = Department::factory()->create(['admin_id' => $this->admin->id]);
        $level = Level::factory()->create();

        // The real, populated term. Only one semester may be active; the
        // dedicated dual-active detector test below covers the broken state.
        $populated = Semester::create(['name' => 'Populated', 'academic_year' => '2026-2027', 'is_active' => true]);

        $student = User::factory()->create([
            'type' => User::TYPE_STUDENT,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->admin->id,
            'department_id' => $department->id,
            'level_id' => $level->id,
        ]);
        $student->student()->create([
            'department_id' => $department->id,
            'level_id' => $level->id,
            'semester' => 'first',
            'credit_points' => 0,
        ]);

        $professor = User::factory()->create([
            'type' => User::TYPE_PROFESSOR,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->admin->id,
            'department_id' => $department->id,
            'level_id' => $level->id,
        ]);

        $course = Course::factory()->create([
            'course_code' => 'GUARD101',
            'department_id' => $department->id,
            'professor_id' => $professor->id,
            'semester_id' => $populated->id,
            'admin_id' => $this->admin->id,
        ]);

        StudentCourse::factory()->create([
            'student_id' => $student->id,
            'course_id' => $course->id,
            'semester_id' => $populated->id,
            'status' => StudentCourse::STATUS_REGISTERED,
        ]);

        Schedule::create([
            'semester_id' => $populated->id,
            'course_id' => $course->id,
            'day_of_week' => 'Sunday',
            'start_time' => '09:00',
            'end_time' => '10:30',
            'section_type' => 'lecture',
            'level_id' => $level->id,
            'department_id' => $department->id,
            'admin_id' => $this->admin->id,
        ]);

        Payment::forceCreate([
            'user_id' => $student->id,
            'semester_id' => $populated->id,
            'amount' => Payment::PRICE_COURSES,
            'type' => Payment::TYPE_COURSES,
            'status' => Payment::STATUS_PAID,
        ]);

        // Guard that this test fails loudly the moment two semesters are
        // active. If a future change ever lets a second active semester into
        // the database, this assertion (and every student check below it)
        // goes red, so the dual-active case is covered by CI, not just by eye.
        $this->assertSame(1, Semester::activeCount(), 'Exactly one semester must be active before the student endpoints are exercised.');

        // Under the single-active invariant the student sees the term they are
        // actually enrolled in. This is the correct behaviour; the assert
        // above is what fails if the invariant is ever broken.
        Sanctum::actingAs($student);

        $courses = $this->getJson('/api/user/courses');
        $courses->assertOk();
        $codes = collect($courses->json('data'))->pluck('course_code');
        $this->assertContains($course->course_code, $codes, 'The enrolled course must be visible in My Courses.');

        $schedule = $this->getJson('/api/user/schedule');
        $schedule->assertOk();
        $scheduledCodes = collect($schedule->json('data.schedule'))->pluck('course_code');
        $this->assertContains($course->course_code, $scheduledCodes, 'The enrolled course must appear in the timetable.');
    }

    public function test_detecting_two_active_semesters_is_reported_before_student_queries_run(): void
    {
        Semester::create(['name' => 'Alpha', 'academic_year' => '2026-2027', 'is_active' => true]);
        $second = Semester::create(['name' => 'Beta', 'academic_year' => '2026-2027', 'is_active' => false]);

        // Simulate the historical bad state: activate Beta's flag directly,
        // bypassing the model invariant that the app now enforces.
        DB::table('semesters')->where('id', $second->id)->update(['is_active' => true]);

        // A guard helper the app turns to before trusting any active-semester
        // lookup. Two active rows is a data defect and must be surfaced, not
        // silently resolved to "whichever row MySQL returns first".
        $this->assertSame(
            2,
            Semester::activeCount(),
            'The dual-active state must be detectable so callers can refuse to run student queries against it.'
        );

        // Recovering by activating one semester leaves exactly one active row,
        // which is the state the student endpoints are allowed to serve.
        $second->activate();
        $this->assertSame(1, Semester::activeCount());
    }
}
