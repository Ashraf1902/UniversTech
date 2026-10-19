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
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Lecture times are wall-clock values: the admin types them in a local
 * <input type="time">, they are validated as H:i and stored verbatim in a
 * `time` column (never shifted to/from UTC). This guarantees the admin form and
 * the student schedule show the exact same HH:mm.
 */
class ScheduleTimeConsistencyTest extends TestCase
{
    use RefreshDatabase;

    private Admin $superAdmin;

    private Department $department;

    private Level $level;

    private Semester $semester;

    private Course $course;

    private User $student;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = Admin::factory()->create(['id' => 1, 'is_super_admin' => true]);
        $this->department = Department::factory()->create(['admin_id' => $this->superAdmin->id]);
        $this->level = Level::factory()->create();

        $this->semester = Semester::create([
            'name' => 'Fall',
            'academic_year' => '2026',
            'is_active' => true,
        ]);

        $this->course = Course::create([
            'course_name' => 'Databases',
            'course_code' => 'CS203',
            'no_of_hours' => 3,
            'cover_image' => 'default.jpg',
            'department_id' => $this->department->id,
            'professor_id' => null,
            'admin_id' => $this->superAdmin->id,
            'semester_id' => $this->semester->id,
        ]);

        $this->student = User::factory()->create([
            'type' => User::TYPE_STUDENT,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ]);

        $this->student->student()->create([
            'department_id' => $this->department->id,
            'level_id' => $this->level->id,
            'semester' => 'first',
            'credit_points' => 0,
        ]);

        StudentCourse::create([
            'student_id' => $this->student->id,
            'course_id' => $this->course->id,
            'progress' => 0,
            'status' => StudentCourse::STATUS_REGISTERED,
            'semester_id' => $this->semester->id,
        ]);

        Payment::forceCreate([
            'user_id' => $this->student->id,
            'semester_id' => $this->semester->id,
            'amount' => Payment::PRICE_COURSES,
            'type' => Payment::TYPE_COURSES,
            'status' => Payment::STATUS_PAID,
            'paid_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_admin_entered_local_times_are_stored_verbatim_and_shown_identically_everywhere(): void
    {
        Sanctum::actingAs($this->superAdmin);

        // The admin form posts exactly what the admin typed (H:i, no timezone).
        $this->postJson('/api/schedule/store', [
            'level_id' => $this->level->id,
            'semester_id' => $this->semester->id,
            'department_id' => $this->department->id,
            'course_id' => $this->course->id,
            'day_of_week' => 'Saturday',
            'start_time' => '09:00',
            'end_time' => '10:30',
            'section_type' => 'lecture',
        ])->assertStatus(201);

        $schedule = Schedule::firstOrFail();

        // Stored as a wall-clock TIME (09:00, not 07:00/06:00 from a UTC shift).
        $this->assertSame('09:00:00', $schedule->getRawOriginal('start_time'));
        $this->assertSame('10:30:00', $schedule->getRawOriginal('end_time'));

        // The admin schedule list shows the same HH:mm the admin typed.
        Sanctum::actingAs($this->superAdmin);
        $adminRow = collect($this->getJson('/api/schedule/get/all')->assertOk()->json('data.data'))
            ->firstWhere('id', $schedule->id);

        $this->assertNotNull($adminRow);
        $this->assertSame('09:00', substr($adminRow['start_time'], 0, 5));
        $this->assertSame('10:30', substr($adminRow['end_time'], 0, 5));

        // The student schedule (rendered in the university timezone, Africa/Cairo)
        // shows the exact same wall-clock times.
        Sanctum::actingAs($this->student);
        $this->getJson('/api/user/schedule')
            ->assertOk()
            ->assertJsonPath('data.schedule.0.start_time', '09:00')
            ->assertJsonPath('data.schedule.0.end_time', '10:30');
    }
}
