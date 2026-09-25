<?php

namespace Tests\Feature;

use App\Models\AccessRequest;
use App\Models\Admin;
use App\Models\Department;
use App\Models\Level;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StudentProfessorProfileTest extends TestCase
{
    use RefreshDatabase;

    private function seedBase(): array
    {
        $admin = Admin::factory()->create(['id' => 1, 'is_super_admin' => true]);
        $department = Department::factory()->create(['id' => 1, 'admin_id' => $admin->id]);
        $level = Level::factory()->create(['id' => 1]);

        return compact('admin', 'department', 'level');
    }

    public function test_student_resource_includes_profile_fields(): void
    {
        $base = $this->seedBase();

        $user = User::factory()->create([
            'type' => User::TYPE_STUDENT,
            'admin_id' => $base['admin']->id,
            'department_id' => null,
            'level_id' => null,
        ]);
        Student::factory()->for($user)->create([
            'department_id' => $base['department']->id,
            'level_id' => $base['level']->id,
            'semester' => 'second',
            'credit_points' => 42,
        ]);

        Sanctum::actingAs($user, ['*']);

        $this->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('data.credit_points', 42)
            ->assertJsonPath('data.semester', 'second')
            ->assertJsonPath('data.department.id', 1)
            ->assertJsonPath('data.level.name', $base['level']->name)
            ->assertJsonPath('data.job_title', null);
    }

    public function test_professor_resource_includes_profile_fields(): void
    {
        $base = $this->seedBase();

        $user = User::factory()->create([
            'type' => User::TYPE_PROFESSOR,
            'admin_id' => $base['admin']->id,
            'department_id' => null,
            'level_id' => null,
        ]);
        $user->professor()->create([
            'department_id' => $base['department']->id,
            'job_title' => 'Professor',
        ]);

        Sanctum::actingAs($user, ['*']);

        $this->getJson('/api/professor/profile')
            ->assertOk()
            ->assertJsonPath('data.job_title', 'Professor')
            ->assertJsonPath('data.department.id', 1)
            ->assertJsonPath('data.credit_points', null);
    }

    public function test_student_record_created_alongside_user_on_access_request_accept(): void
    {
        $base = $this->seedBase();

        $pending = AccessRequest::create([
            'name' => 'New Student',
            'email' => 'newstudent@test.com',
            'password' => bcrypt('password'),
            'phone' => '01111111111',
            'national_id' => '302000000001',
            'gender' => 0,
            'department_id' => $base['department']->id,
            'level_id' => $base['level']->id,
            'status' => AccessRequest::STATUS_PENDING,
        ]);

        Sanctum::actingAs($base['admin'], ['*']);

        $response = $this->postJson('/api/access-request/respond', [
            'id' => $pending->id,
            'action' => 'accept',
        ]);
        $response->assertOk();

        $this->assertDatabaseHas('users', [
            'email' => 'newstudent@test.com',
        ]);

        $user = User::where('email', 'newstudent@test.com')->first();

        $this->assertNotNull($user);
        $response->assertJsonPath('data.user_id', $user->id);

        $this->assertDatabaseHas('students', [
            'user_id' => $user->id,
            'department_id' => $base['department']->id,
            'level_id' => $base['level']->id,
        ]);
    }
}