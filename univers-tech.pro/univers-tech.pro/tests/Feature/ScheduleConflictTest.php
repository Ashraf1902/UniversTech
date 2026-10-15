<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Course;
use App\Models\Department;
use App\Models\Level;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Semester;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ScheduleConflictTest extends TestCase
{
    use RefreshDatabase;

    private Admin $superAdmin;

    private Department $department;

    private Level $level;

    private Semester $semester;

    private Semester $inactiveSemester;

    private User $professorA;

    private User $professorB;

    private Course $courseA;

    private Course $courseB;

    private Room $room1;

    private Room $room2;

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
        $this->inactiveSemester = Semester::create([
            'name' => 'Spring',
            'academic_year' => '2026',
            'is_active' => false,
        ]);

        $this->professorA = $this->makeProfessor();
        $this->professorB = $this->makeProfessor();

        $this->courseA = $this->makeCourse('Algorithms', 'CS101', $this->professorA);
        $this->courseB = $this->makeCourse('Databases', 'CS202', $this->professorB);

        $this->room1 = Room::create(['name' => 'R1', 'building' => 'A', 'capacity' => 40]);
        $this->room2 = Room::create(['name' => 'R2', 'building' => 'A', 'capacity' => 40]);
    }

    private function makeProfessor(): User
    {
        return User::factory()->create([
            'type' => User::TYPE_PROFESSOR,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ]);
    }

    private function makeCourse(string $name, string $code, User $professor): Course
    {
        return Course::create([
            'course_name' => $name,
            'course_code' => $code,
            'no_of_hours' => 3,
            'department_id' => $this->department->id,
            'professor_id' => $professor->id,
            'admin_id' => $this->superAdmin->id,
            'semester_id' => $this->semester->id,
        ]);
    }

    private function actingAsAdmin(array $roles = [], bool $super = false): Admin
    {
        $admin = $super
            ? Admin::factory()->create(['is_super_admin' => true])
            : Admin::factory()->create(['is_super_admin' => false, 'roles' => $roles]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function schedule(Course $course, array $overrides = []): Schedule
    {
        return Schedule::create(array_merge([
            'level_id' => $this->level->id,
            'semester_id' => $this->semester->id,
            'department_id' => $this->department->id,
            'course_id' => $course->id,
            'room_id' => $this->room1->id,
            'day_of_week' => 'Saturday',
            'start_time' => '09:00',
            'end_time' => '10:00',
            'section_type' => 'lecture',
            'admin_id' => $this->superAdmin->id,
        ], $overrides));
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(Course $course, array $overrides = []): array
    {
        return array_merge([
            'level_id' => $this->level->id,
            'semester_id' => $this->semester->id,
            'department_id' => $this->department->id,
            'course_id' => $course->id,
            'room_id' => $this->room1->id,
            'day_of_week' => 'Saturday',
            'start_time' => '09:00',
            'end_time' => '10:00',
            'section_type' => 'lecture',
        ], $overrides);
    }

    public function test_admin_can_create_schedule_with_a_room(): void
    {
        $this->actingAsAdmin(['schedules']);

        $this->postJson('/api/schedule/store', $this->payload($this->courseA))
            ->assertStatus(201);

        $this->assertDatabaseHas('schedules', [
            'course_id' => $this->courseA->id,
            'room_id' => $this->room1->id,
        ]);
    }

    public function test_room_overlap_is_rejected(): void
    {
        $this->schedule($this->courseA);

        $this->actingAsAdmin(['schedules']);

        $response = $this->postJson('/api/schedule/store', $this->payload($this->courseB, [
            'start_time' => '09:30',
            'end_time' => '10:30',
        ]))->assertStatus(422);

        $types = collect($response->json('data.conflicts'))->pluck('type');
        $this->assertTrue($types->contains('room'));
        $this->assertSame(1, Schedule::count());
    }

    public function test_professor_overlap_is_rejected(): void
    {
        $this->schedule($this->courseA);

        $courseC = $this->makeCourse('Networks', 'CS303', $this->professorA);

        $this->actingAsAdmin(['schedules']);

        $response = $this->postJson('/api/schedule/store', $this->payload($courseC, [
            'room_id' => $this->room2->id,
            'start_time' => '09:30',
            'end_time' => '10:30',
        ]))->assertStatus(422);

        $types = collect($response->json('data.conflicts'))->pluck('type');
        $this->assertTrue($types->contains('professor'));
        $this->assertSame(1, Schedule::count());
    }

    public function test_touching_boundaries_do_not_conflict(): void
    {
        $this->schedule($this->courseA);

        $this->actingAsAdmin(['schedules']);

        $this->postJson('/api/schedule/store', $this->payload($this->courseB, [
            'start_time' => '10:00',
            'end_time' => '11:00',
        ]))->assertStatus(201);

        $this->assertSame(2, Schedule::count());
    }

    public function test_level_department_overlap_is_a_warning_not_a_block(): void
    {
        $this->schedule($this->courseA);

        $this->actingAsAdmin(['schedules']);

        $response = $this->postJson('/api/schedule/store', $this->payload($this->courseB, [
            'room_id' => $this->room2->id,
            'start_time' => '09:30',
            'end_time' => '10:30',
        ]))->assertStatus(201);

        $warnings = collect($response->json('data.warnings'))->pluck('type');
        $this->assertTrue($warnings->contains('level_department'));
        $this->assertSame(2, Schedule::count());
    }

    public function test_update_ignores_the_schedule_itself(): void
    {
        $schedule = $this->schedule($this->courseA);

        $this->actingAsAdmin(['schedules']);

        $this->postJson('/api/schedule/update', [
            'schedule_id' => $schedule->id,
            'start_time' => '09:15',
            'end_time' => '10:30',
        ])->assertOk();
    }

    public function test_update_rejects_a_conflict_with_another_schedule(): void
    {
        $this->schedule($this->courseA);
        $other = $this->schedule($this->courseB, [
            'room_id' => $this->room2->id,
            'start_time' => '11:00',
            'end_time' => '12:00',
        ]);

        $this->actingAsAdmin(['schedules']);

        $this->postJson('/api/schedule/update', [
            'schedule_id' => $other->id,
            'room_id' => $this->room1->id,
            'start_time' => '09:30',
            'end_time' => '10:30',
        ])->assertStatus(422);
    }

    public function test_conflict_report_lists_existing_conflicts(): void
    {
        $this->schedule($this->courseA);
        $this->schedule($this->courseB, ['start_time' => '09:30', 'end_time' => '10:30']);

        $this->actingAsAdmin(['schedules']);

        $response = $this->getJson('/api/schedule/conflicts')->assertOk();

        $this->assertGreaterThanOrEqual(1, $response->json('data.count'));
        $types = collect($response->json('data.conflicts'))->pluck('type');
        $this->assertTrue($types->contains('room'));
    }

    public function test_conflict_report_requires_the_schedules_scope(): void
    {
        $this->actingAsAdmin(['courses']);
        $this->getJson('/api/schedule/conflicts')->assertStatus(403);
    }

    public function test_room_creation_rejects_duplicates(): void
    {
        $this->actingAsAdmin(['schedules']);

        $this->postJson('/api/room/store', ['name' => 'R1', 'building' => 'A'])
            ->assertStatus(422);
    }

    public function test_professor_timetable_lists_only_own_active_courses(): void
    {
        $this->schedule($this->courseA);
        $this->schedule($this->courseB, ['start_time' => '11:00', 'end_time' => '12:00']);
        $this->schedule($this->courseA, [
            'semester_id' => $this->inactiveSemester->id,
            'start_time' => '13:00',
            'end_time' => '14:00',
        ]);

        Sanctum::actingAs($this->professorA);

        $response = $this->getJson('/api/professor/schedule')->assertOk();

        $rows = collect($response->json('data.schedule'));
        $this->assertCount(1, $rows);
        $this->assertSame($this->courseA->id, $rows->first()['course_id']);
        $this->assertSame($this->room1->name, $rows->first()['room']);
    }

    public function test_professor_timetable_requires_the_professor_role(): void
    {
        $student = User::factory()->create([
            'type' => User::TYPE_STUDENT,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ]);

        Sanctum::actingAs($student);

        $this->getJson('/api/professor/schedule')->assertStatus(403);
    }
}
