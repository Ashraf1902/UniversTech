<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Department;
use App\Models\Event;
use App\Models\Level;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EventTargetingTest extends TestCase
{
    use RefreshDatabase;

    private Admin $superAdmin;

    private Department $departmentA;

    private Department $departmentB;

    private Level $levelOne;

    private Level $levelTwo;

    /** @var array<int, User> */
    private array $students = [];

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('files');

        $this->superAdmin = Admin::factory()->create(['id' => 1, 'is_super_admin' => true]);
        $this->departmentA = Department::factory()->create(['admin_id' => $this->superAdmin->id]);
        $this->departmentB = Department::factory()->create(['admin_id' => $this->superAdmin->id]);
        $this->levelOne = Level::factory()->create();
        $this->levelTwo = Level::factory()->create();

        $this->students['a_one'] = $this->makeStudent($this->departmentA->id, $this->levelOne->id);
        $this->students['b_two'] = $this->makeStudent($this->departmentB->id, $this->levelTwo->id);
        $this->students['a_two'] = $this->makeStudent($this->departmentA->id, $this->levelTwo->id);
        $this->students['b_one'] = $this->makeStudent($this->departmentB->id, $this->levelOne->id);
    }

    private function makeStudent(int $departmentId, int $levelId): User
    {
        $user = User::factory()->create([
            'type' => User::TYPE_STUDENT,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ]);

        $user->student()->create([
            'department_id' => $departmentId,
            'level_id' => $levelId,
            'semester' => 'first',
            'credit_points' => 0,
        ]);

        return $user;
    }

    private function actingAsAdmin(array $roles): Admin
    {
        $admin = Admin::factory()->create(['is_super_admin' => false, 'roles' => $roles]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function storeEvent(array $overrides = [])
    {
        return $this->post('/api/event/store', array_merge([
            'title' => 'Campus fair',
            'content' => 'Join us at the main hall.',
            'image' => UploadedFile::fake()->image('event.jpg'),
        ], $overrides));
    }

    public function test_targeted_event_notifies_only_students_matching_the_selected_departments_and_levels(): void
    {
        $this->actingAsAdmin(['events']);

        $this->storeEvent([
            'audience' => 'targeted',
            'departments' => [$this->departmentA->id],
            'levels' => [$this->levelTwo->id],
        ])->assertStatus(201);

        $event = Event::first();
        $this->assertSame('targeted', $event->audience);
        $this->assertEqualsCanonicalizing([$this->departmentA->id], $event->departments()->pluck('departments.id')->all());
        $this->assertEqualsCanonicalizing([$this->levelTwo->id], $event->levels()->pluck('levels.id')->all());

        $recipients = Notification::where('type', Notification::TYPE_EVENT)
            ->pluck('student_id')
            ->map(fn ($id) => (int) $id)
            ->sort()
            ->values()
            ->all();

        $expected = collect([
            $this->students['a_one']->id,
            $this->students['b_two']->id,
            $this->students['a_two']->id,
        ])->sort()->values()->all();

        $this->assertSame($expected, $recipients);
        $this->assertDatabaseMissing('notifications', ['student_id' => $this->students['b_one']->id]);

        $this->assertDatabaseHas('event_departments', [
            'event_id' => $event->id,
            'department_id' => $this->departmentA->id,
        ]);
        $this->assertDatabaseHas('event_levels', [
            'event_id' => $event->id,
            'level_id' => $this->levelTwo->id,
        ]);
    }

    public function test_targeted_event_without_any_target_is_rejected_with_422(): void
    {
        $this->actingAsAdmin(['events']);

        $this->storeEvent(['audience' => 'targeted'])->assertStatus(422);

        $this->assertDatabaseCount('events', 0);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_events_created_without_an_audience_default_to_all_and_notify_every_student(): void
    {
        $this->actingAsAdmin(['events']);

        $this->storeEvent()->assertStatus(201);

        $event = Event::first();
        $this->assertSame('all', $event->audience);

        $recipients = Notification::where('type', Notification::TYPE_EVENT)->count();
        $this->assertSame(User::where('type', User::TYPE_STUDENT)->count(), $recipients);
    }

    public function test_event_requires_the_events_scope(): void
    {
        $this->actingAsAdmin(['courses']);

        $this->storeEvent()->assertStatus(403);
        $this->assertDatabaseCount('events', 0);
    }

    public function test_public_events_carousel_only_shows_events_addressed_to_everyone(): void
    {
        Event::create([
            'title' => 'Public day',
            'content' => 'Open to all.',
            'admin_id' => $this->superAdmin->id,
            'image' => 'public.jpg',
            'audience' => 'all',
        ]);
        Event::create([
            'title' => 'Closed briefing',
            'content' => 'Targeted only.',
            'admin_id' => $this->superAdmin->id,
            'image' => 'targeted.jpg',
            'audience' => 'targeted',
        ]);

        $this->getJson('/api/public/events')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Public day');
    }

    public function test_student_events_feed_only_returns_events_fanned_out_to_that_student(): void
    {
        Notification::create([
            'student_id' => $this->students['a_one']->id,
            'title' => 'For you',
            'content' => 'Targeted event.',
            'type' => Notification::TYPE_EVENT,
        ]);
        Notification::create([
            'student_id' => $this->students['b_two']->id,
            'title' => 'Not for you',
            'content' => 'Another targeted event.',
            'type' => Notification::TYPE_EVENT,
        ]);

        Sanctum::actingAs($this->students['a_one']);

        $this->getJson('/api/user/notifications/events')
            ->assertStatus(200)
            ->assertJsonPath('data.0.title', 'For you')
            ->assertJsonCount(1, 'data');
    }

    public function test_admin_can_retarget_an_existing_event_and_the_payload_exposes_the_targets(): void
    {
        $event = Event::create([
            'title' => 'Retarget me',
            'content' => 'Content.',
            'admin_id' => $this->superAdmin->id,
            'image' => 'retarget.jpg',
            'audience' => 'all',
        ]);

        $this->actingAsAdmin(['events']);

        $this->postJson('/api/event/update', [
            'event_id' => $event->id,
            'audience' => 'targeted',
            'departments' => [$this->departmentB->id],
            'levels' => [],
        ])->assertStatus(200);

        $event->refresh();
        $this->assertSame('targeted', $event->audience);
        $this->assertEqualsCanonicalizing([$this->departmentB->id], $event->departments()->pluck('departments.id')->all());
        $this->assertSame([], $event->levels()->pluck('levels.id')->all());

        $this->getJson('/api/event/single/' . $event->id)
            ->assertStatus(200)
            ->assertJsonPath('data.audience', 'targeted')
            ->assertJsonPath('data.target_departments.0.id', $this->departmentB->id)
            ->assertJsonPath('data.target_levels', []);
    }

    public function test_retargeting_an_event_without_targets_is_rejected(): void
    {
        $event = Event::create([
            'title' => 'Stays public',
            'content' => 'Content.',
            'admin_id' => $this->superAdmin->id,
            'image' => 'keep.jpg',
            'audience' => 'all',
        ]);

        $this->actingAsAdmin(['events']);

        $this->postJson('/api/event/update', [
            'event_id' => $event->id,
            'audience' => 'targeted',
        ])->assertStatus(422);

        $this->assertSame('all', $event->refresh()->audience);
    }

    public function test_a_student_without_a_profile_is_never_a_target(): void
    {
        $targetedDepartment = Department::factory()->create(['admin_id' => $this->superAdmin->id]);
        $profileless = User::factory()->create([
            'type' => User::TYPE_STUDENT,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ]);

        $this->actingAsAdmin(['events']);

        $this->storeEvent([
            'audience' => 'targeted',
            'departments' => [$targetedDepartment->id],
        ])->assertStatus(201);

        $this->assertDatabaseMissing('notifications', ['student_id' => $profileless->id]);
        $this->assertSame(0, Notification::where('type', Notification::TYPE_EVENT)->count());
    }
}
