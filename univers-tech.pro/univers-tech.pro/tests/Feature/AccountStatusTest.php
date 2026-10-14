<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccountStatusTest extends TestCase
{
    use RefreshDatabase;

    private int $adminId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminId = Admin::factory()->create(['is_super_admin' => true])->id;
    }

    private function makeActiveStudent(array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'type' => User::TYPE_STUDENT,
            'status' => User::STATUS_ACTIVE,
            'password' => bcrypt('password'),
            'admin_id' => $this->adminId,
            'department_id' => null,
            'level_id' => null,
        ], $attributes));
    }

    public function test_new_accounts_default_to_active_status(): void
    {
        $user = User::factory()->create([
            'type' => User::TYPE_STUDENT,
            'admin_id' => $this->adminId,
            'department_id' => null,
            'level_id' => null,
        ]);

        $this->assertSame(User::STATUS_ACTIVE, $user->fresh()->status);
    }

    public function test_suspended_student_cannot_log_in(): void
    {
        $student = $this->makeActiveStudent(['status' => User::STATUS_SUSPENDED]);

        $this->postJson('/api/auth/login', [
            'email' => $student->email,
            'password' => 'password',
        ])->assertStatus(403);
    }

    public function test_suspended_professor_cannot_log_in(): void
    {
        $professor = User::factory()->create([
            'type' => User::TYPE_PROFESSOR,
            'status' => User::STATUS_GRADUATED,
            'password' => bcrypt('password'),
            'admin_id' => $this->adminId,
            'department_id' => null,
            'level_id' => null,
        ]);

        $this->postJson('/api/prof/auth/login', [
            'email' => $professor->email,
            'password' => 'password',
        ])->assertStatus(403);
    }

    public function test_active_student_can_log_in(): void
    {
        $student = $this->makeActiveStudent();

        $this->postJson('/api/auth/login', [
            'email' => $student->email,
            'password' => 'password',
        ])->assertOk();
    }

    public function test_existing_token_stops_working_after_suspension(): void
    {
        $student = $this->makeActiveStudent();
        $student->createToken('student-token');

        $this->assertDatabaseCount('personal_access_tokens', 1);

        Sanctum::actingAs($student);
        $student->forceFill(['status' => User::STATUS_SUSPENDED])->save();
        $student->refresh();

        $this->getJson('/api/user')->assertStatus(403);
    }

    public function test_admin_without_accounts_scope_cannot_change_status(): void
    {
        $admin = Admin::factory()->create(['is_super_admin' => false, 'roles' => ['courses']]);
        $student = $this->makeActiveStudent();

        Sanctum::actingAs($admin);

        $this->putJson('/api/user/update', [
            'account_id' => $student->id,
            'status' => User::STATUS_SUSPENDED,
        ])->assertStatus(403);

        $this->assertSame(User::STATUS_ACTIVE, $student->fresh()->status);
    }

    public function test_accounts_admin_can_change_status_and_tokens_are_revoked(): void
    {
        $admin = Admin::factory()->create(['is_super_admin' => false, 'roles' => ['accounts']]);
        $student = $this->makeActiveStudent();
        $student->createToken('student-token');

        Sanctum::actingAs($admin);

        $this->putJson('/api/user/update', [
            'account_id' => $student->id,
            'status' => User::STATUS_SUSPENDED,
        ])->assertOk();

        $student->refresh();
        $this->assertSame(User::STATUS_SUSPENDED, $student->status);
        $this->assertSame(0, $student->tokens()->count());
    }
}
