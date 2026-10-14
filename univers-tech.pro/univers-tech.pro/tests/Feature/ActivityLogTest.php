<?php

namespace Tests\Feature;

use App\Models\AccessRequest;
use App\Models\ActivityLog;
use App\Models\Admin;
use App\Models\Course;
use App\Models\Department;
use App\Models\StudentCourse;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ActivityLogTest extends TestCase
{
    use RefreshDatabase;

    private Admin $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = Admin::factory()->create(['is_super_admin' => true]);
    }

    private function actingAsAdmin(array $roles = [], bool $super = false): Admin
    {
        $admin = $super
            ? $this->superAdmin
            : Admin::factory()->create(['is_super_admin' => false, 'roles' => $roles]);

        Sanctum::actingAs($admin);

        return $admin;
    }

    private function makeActiveStudent(array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'type' => User::TYPE_STUDENT,
            'status' => User::STATUS_ACTIVE,
            'password' => bcrypt('password'),
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ], $attributes));
    }

    public function test_model_lifecycle_actions_are_logged_with_the_admin_actor(): void
    {
        $admin = $this->actingAsAdmin(super: true);

        $this->postJson('/api/department/store', ['name' => 'Physics', 'abbrevation' => 'PHY'])
            ->assertStatus(201);

        $department = Department::where('name', 'Physics')->firstOrFail();

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'created',
            'subject_type' => Department::class,
            'subject_id' => $department->id,
            'actor_type' => Admin::class,
            'actor_id' => $admin->id,
        ]);

        $this->deleteJson("/api/department/delete/{$department->id}")->assertOk();
        $this->assertDatabaseHas('activity_logs', [
            'action' => 'deleted',
            'subject_id' => $department->id,
        ]);

        $this->postJson("/api/department/restore/{$department->id}")->assertOk();
        $this->assertDatabaseHas('activity_logs', [
            'action' => 'restored',
            'subject_id' => $department->id,
        ]);

        $this->deleteJson("/api/department/purge/{$department->id}")->assertOk();
        $this->assertDatabaseHas('activity_logs', [
            'action' => 'force_deleted',
            'subject_id' => $department->id,
        ]);
    }

    public function test_successful_login_is_logged_with_the_user_as_actor(): void
    {
        $student = $this->makeActiveStudent();

        $this->postJson('/api/auth/login', [
            'email' => $student->email,
            'password' => 'password',
        ])->assertOk();

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'login',
            'actor_type' => User::class,
            'actor_id' => $student->id,
        ]);
    }

    public function test_failed_login_is_logged_without_an_actor(): void
    {
        $student = $this->makeActiveStudent();

        $this->postJson('/api/auth/login', [
            'email' => $student->email,
            'password' => 'wrong-password',
        ])->assertStatus(401);

        $log = ActivityLog::where('action', 'login_failed')->first();

        $this->assertNotNull($log);
        $this->assertNull($log->actor_type);
        $this->assertNull($log->actor_id);
        $this->assertSame($student->email, $log->properties['email']);
    }

    public function test_status_change_is_logged_and_notifies_the_account(): void
    {
        $this->actingAsAdmin(roles: ['accounts']);
        $student = $this->makeActiveStudent();

        $this->putJson('/api/user/update', [
            'account_id' => $student->id,
            'status' => User::STATUS_SUSPENDED,
        ])->assertOk();

        $log = ActivityLog::where('action', 'status_changed')->first();

        $this->assertNotNull($log);
        $this->assertSame($student->id, $log->subject_id);
        $this->assertSame(User::STATUS_ACTIVE, $log->properties['from']);
        $this->assertSame(User::STATUS_SUSPENDED, $log->properties['to']);

        $this->assertDatabaseHas('notifications', ['student_id' => $student->id]);
    }

    public function test_admin_role_changes_are_logged_and_accept_the_activity_scope(): void
    {
        $this->actingAsAdmin(super: true);
        $target = Admin::factory()->create(['is_super_admin' => false, 'roles' => []]);

        $this->postJson('/api/admin-management/update', [
            'id' => $target->id,
            'roles' => ['courses', 'activity'],
        ])->assertOk();

        $this->assertSame(['courses', 'activity'], $target->fresh()->roles);

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'admin_updated',
            'subject_type' => Admin::class,
            'subject_id' => $target->id,
        ]);

        $this->assertDatabaseHas('notifications', ['admin_id' => $target->id]);
    }

    public function test_access_request_acceptance_is_logged(): void
    {
        $this->actingAsAdmin(roles: ['access_requests']);

        $accessRequest = AccessRequest::create([
            'name' => 'New Student',
            'email' => 'new.student@example.com',
            'password' => bcrypt('password'),
            'gender' => 0,
            'status' => AccessRequest::STATUS_PENDING,
        ]);

        $this->postJson('/api/access-request/respond', [
            'id' => $accessRequest->id,
            'action' => 'accept',
        ])->assertOk();

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'access_request_accepted',
            'subject_type' => AccessRequest::class,
            'subject_id' => $accessRequest->id,
        ]);
    }

    public function test_accepting_a_request_for_a_trashed_email_is_rejected(): void
    {
        $this->actingAsAdmin(roles: ['access_requests']);

        $student = $this->makeActiveStudent();
        $student->delete();

        $accessRequest = AccessRequest::create([
            'name' => 'Rejoin',
            'email' => $student->email,
            'password' => bcrypt('password'),
            'gender' => 0,
            'status' => AccessRequest::STATUS_PENDING,
        ]);

        $this->postJson('/api/access-request/respond', [
            'id' => $accessRequest->id,
            'action' => 'accept',
        ])->assertStatus(409);
    }

    public function test_study_progress_updates_do_not_flood_the_log(): void
    {
        $professor = User::factory()->create([
            'type' => User::TYPE_PROFESSOR,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->superAdmin->id,
            'department_id' => null,
            'level_id' => null,
        ]);

        $course = Course::create([
            'course_name' => 'Algorithms',
            'no_of_hours' => 3,
            'course_code' => 'CS301',
            'cover_image' => 'default.jpg',
            'department_id' => null,
            'professor_id' => $professor->id,
            'admin_id' => $this->superAdmin->id,
            'semester_id' => null,
        ]);

        $student = $this->makeActiveStudent();

        $enrollment = StudentCourse::create([
            'student_id' => $student->id,
            'course_id' => $course->id,
            'progress' => 0,
        ]);

        $before = ActivityLog::where('action', 'updated')->count();

        $enrollment->update(['progress' => 40]);
        $enrollment->update(['progress' => 80]);

        $this->assertSame($before, ActivityLog::where('action', 'updated')->count());
    }

    public function test_activity_endpoint_requires_the_activity_scope(): void
    {
        $this->actingAsAdmin(roles: ['courses']);
        $this->getJson('/api/activity/get/all')->assertStatus(403);

        Sanctum::actingAs($this->superAdmin);
        $this->getJson('/api/activity/get/all')->assertOk();
    }

    public function test_activity_endpoint_can_filter_by_action(): void
    {
        ActivityLog::create([
            'action' => 'login',
            'actor_type' => User::class,
            'actor_id' => $this->makeActiveStudent()->id,
            'created_at' => now(),
        ]);

        ActivityLog::create([
            'action' => 'created',
            'subject_type' => Department::class,
            'subject_id' => 1,
            'created_at' => now(),
        ]);

        Sanctum::actingAs($this->superAdmin);

        $response = $this->getJson('/api/activity/get/all?action=login')->assertOk();

        $actions = collect($response->json('data.data'))->pluck('action')->unique()->values()->all();

        $this->assertSame(['login'], $actions);
    }

    public function test_activity_endpoint_can_filter_by_subject_type_and_date(): void
    {
        ActivityLog::create([
            'action' => 'created',
            'subject_type' => Course::class,
            'subject_id' => 1,
            'created_at' => now(),
        ]);

        ActivityLog::create([
            'action' => 'created',
            'subject_type' => Department::class,
            'subject_id' => 1,
            'created_at' => now()->subDays(5),
        ]);

        Sanctum::actingAs($this->superAdmin);

        $bySubject = $this->getJson('/api/activity/get/all?subject_type=Course')->assertOk();
        $subjects = collect($bySubject->json('data.data'))->pluck('subject.type')->unique()->values()->all();
        $this->assertSame(['Course'], $subjects);

        $byDate = $this->getJson('/api/activity/get/all?from=' . now()->subDay()->toDateString())->assertOk();
        $this->assertCount(1, $byDate->json('data.data'));
    }

    public function test_activity_log_has_no_write_or_delete_route(): void
    {
        $this->actingAsAdmin(super: true);

        $this->postJson('/api/activity/get/all')->assertStatus(405);
        $this->deleteJson('/api/activity/get/all')->assertStatus(405);
    }

    public function test_sensitive_and_national_id_fields_are_masked(): void
    {
        $student = $this->makeActiveStudent(['nationalid' => '12345678901234']);

        $student->update(['nationalid' => '99999999999999', 'password' => bcrypt('new-secret')]);

        $log = ActivityLog::where('action', 'updated')->latest('id')->first();

        $this->assertNotNull($log);
        $this->assertSame('***', $log->properties['attributes']['nationalid']);
        $this->assertSame('***', $log->properties['old']['nationalid']);
        $this->assertSame('***', $log->properties['attributes']['password']);
    }

    public function test_prune_command_respects_config_and_force(): void
    {
        DB::table('activity_logs')->insert([
            'action' => 'login',
            'created_at' => now()->subMonths(30),
        ]);

        $this->assertDatabaseCount('activity_logs', 1);

        $this->artisan('activity-log:prune')->assertSuccessful();
        $this->assertDatabaseCount('activity_logs', 1);

        $this->artisan('activity-log:prune', ['--force' => true])->assertSuccessful();
        $this->assertDatabaseCount('activity_logs', 0);
    }
}
