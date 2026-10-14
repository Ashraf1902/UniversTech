<?php

namespace Tests\Feature;

use App\Mail\ResetPasswordMail;
use App\Models\Admin;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    private Admin $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = Admin::factory()->create(['is_super_admin' => true]);
    }

    private function makeUser(int $type): User
    {
        return User::factory()->create([
            'type' => $type,
            'status' => User::STATUS_ACTIVE,
            'password' => bcrypt('password'),
            'admin_id' => $this->admin->id,
            'department_id' => null,
            'level_id' => null,
        ]);
    }

    public function test_forgot_password_returns_the_same_message_for_known_and_unknown_email(): void
    {
        Mail::fake();
        $student = $this->makeUser(User::TYPE_STUDENT);

        $known = $this->postJson('/api/auth/forgot-password', ['email' => $student->email]);
        $unknown = $this->postJson('/api/auth/forgot-password', ['email' => 'nobody@example.com']);

        $known->assertOk();
        $unknown->assertOk();
        $this->assertSame($known->json('message'), $unknown->json('message'));
        $this->assertStringContainsString('If an account exists', $known->json('message'));

        Mail::assertQueued(ResetPasswordMail::class, 1);
    }

    public function test_forgot_password_email_contains_a_frontend_reset_link(): void
    {
        Mail::fake();
        $student = $this->makeUser(User::TYPE_STUDENT);

        $this->postJson('/api/auth/forgot-password', ['email' => $student->email])->assertOk();

        Mail::assertQueued(ResetPasswordMail::class, function (ResetPasswordMail $mail) {
            return str_contains($mail->resetUrl, config('app.frontend_url'))
                && str_contains($mail->resetUrl, 'reset-password')
                && str_contains($mail->resetUrl, 'token=');
        });
    }

    public function test_password_can_be_reset_with_a_valid_token_and_tokens_are_revoked(): void
    {
        $student = $this->makeUser(User::TYPE_STUDENT);
        $student->createToken('phone');

        $token = Password::broker('users')->createToken($student);

        $this->postJson('/api/auth/reset-password', [
            'token' => $token,
            'email' => $student->email,
            'password' => 'brand-new-secret',
            'password_confirmation' => 'brand-new-secret',
        ])->assertOk();

        $this->assertTrue(Hash::check('brand-new-secret', $student->fresh()->password));
        $this->assertSame(0, $student->tokens()->count());
        $this->assertDatabaseHas('activity_logs', ['action' => 'password_reset']);

        // The token cannot be reused.
        $this->postJson('/api/auth/reset-password', [
            'token' => $token,
            'email' => $student->email,
            'password' => 'another-secret',
            'password_confirmation' => 'another-secret',
        ])->assertStatus(422);
    }

    public function test_expired_reset_token_is_rejected(): void
    {
        $student = $this->makeUser(User::TYPE_STUDENT);

        $token = Password::broker('users')->createToken($student);

        DB::table('password_resets')
            ->where('email', $student->email)
            ->update(['created_at' => now()->subMinutes(120)]);

        $this->postJson('/api/auth/reset-password', [
            'token' => $token,
            'email' => $student->email,
            'password' => 'brand-new-secret',
            'password_confirmation' => 'brand-new-secret',
        ])->assertStatus(422);

        $this->assertTrue(Hash::check('password', $student->fresh()->password));
    }

    public function test_reset_works_for_professor_realm(): void
    {
        $professor = $this->makeUser(User::TYPE_PROFESSOR);
        $token = Password::broker('users')->createToken($professor);

        $this->postJson('/api/prof/auth/reset-password', [
            'token' => $token,
            'email' => $professor->email,
            'password' => 'prof-new-secret',
            'password_confirmation' => 'prof-new-secret',
        ])->assertOk();

        $this->assertTrue(Hash::check('prof-new-secret', $professor->fresh()->password));
    }

    public function test_reset_works_for_admin_realm(): void
    {
        $admin = Admin::factory()->create(['password' => bcrypt('password')]);
        $token = Password::broker('admins')->createToken($admin);

        $this->postJson('/api/admin/auth/reset-password', [
            'token' => $token,
            'email' => $admin->email,
            'password' => 'admin-new-secret',
            'password_confirmation' => 'admin-new-secret',
        ])->assertOk();

        $this->assertTrue(Hash::check('admin-new-secret', $admin->fresh()->password));
    }

    public function test_forgot_password_endpoint_is_throttled(): void
    {
        Mail::fake();

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/forgot-password', ['email' => 'x@example.com'])->assertOk();
        }

        $this->postJson('/api/auth/forgot-password', ['email' => 'x@example.com'])->assertStatus(429);
    }

    public function test_change_password_requires_the_current_password(): void
    {
        $student = $this->makeUser(User::TYPE_STUDENT);
        Sanctum::actingAs($student);

        $this->postJson('/api/user/change-password', [
            'current_password' => 'not-my-password',
            'password' => 'brand-new-secret',
            'password_confirmation' => 'brand-new-secret',
        ])->assertStatus(422);

        $this->assertTrue(Hash::check('password', $student->fresh()->password));
    }

    public function test_change_password_keeps_the_current_token_and_revokes_others(): void
    {
        $student = $this->makeUser(User::TYPE_STUDENT);

        $keep = $student->createToken('this-device')->plainTextToken;
        $student->createToken('other-device');

        $this->withHeader('Authorization', "Bearer {$keep}")
            ->postJson('/api/user/change-password', [
                'current_password' => 'password',
                'password' => 'brand-new-secret',
                'password_confirmation' => 'brand-new-secret',
            ])->assertOk();

        $this->assertTrue(Hash::check('brand-new-secret', $student->fresh()->password));
        $this->assertSame(1, $student->tokens()->count());
        $this->assertDatabaseHas('activity_logs', ['action' => 'password_changed']);
    }
}
