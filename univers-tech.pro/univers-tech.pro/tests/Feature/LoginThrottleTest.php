<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class LoginThrottleTest extends TestCase
{
    use RefreshDatabase;

    private Admin $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = Admin::factory()->create(['is_super_admin' => true]);
    }

    private function makeStudent(string $email): User
    {
        return User::factory()->create([
            'email' => $email,
            'type' => User::TYPE_STUDENT,
            'status' => User::STATUS_ACTIVE,
            'password' => bcrypt('correct-password'),
            'admin_id' => $this->admin->id,
            'department_id' => null,
            'level_id' => null,
        ]);
    }

    /**
     * A POST to the student login with an existing email and a wrong password
     * (valid enough to pass the FormRequest, so the only gate hit is throttle).
     */
    private function attempt(string $email, array $headers = [])
    {
        return $this->withHeaders($headers)
            ->postJson('/api/auth/login', ['email' => $email, 'password' => 'wrong-password']);
    }

    public function test_sixth_failed_login_for_the_same_email_is_throttled(): void
    {
        $this->makeStudent('student@example.test');

        for ($i = 0; $i < 5; $i++) {
            $this->attempt('student@example.test')->assertStatus(401);
        }

        $this->attempt('student@example.test')->assertStatus(429);
    }

    public function test_login_throttle_is_keyed_per_email(): void
    {
        $this->makeStudent('a@example.test');
        $this->makeStudent('b@example.test');

        for ($i = 0; $i < 5; $i++) {
            $this->attempt('a@example.test')->assertStatus(401);
        }

        // A different account from the same client is its own bucket, so it is
        // not locked out by the other account's failures.
        $this->attempt('b@example.test')->assertStatus(401);
    }

    public function test_login_throttle_is_keyed_per_client_ip(): void
    {
        $this->makeStudent('student@example.test');

        $ipA = ['X-Forwarded-For' => '203.0.113.10'];
        $ipB = ['X-Forwarded-For' => '203.0.113.20'];

        for ($i = 0; $i < 5; $i++) {
            $this->attempt('student@example.test', $ipA)->assertStatus(401);
        }
        $this->attempt('student@example.test', $ipA)->assertStatus(429);

        // Same email but a different source IP is a different bucket: it proves
        // the trusted-proxy header fed $request->ip() into the throttle key.
        $this->attempt('student@example.test', $ipB)->assertStatus(401);
    }

    public function test_forwarded_for_header_sets_the_client_ip(): void
    {
        Route::middleware('api')->get('/api/__ip', function (Request $request) {
            return response()->json(['ip' => $request->ip()]);
        });

        $this->withHeaders(['X-Forwarded-For' => '198.51.100.7'])
            ->getJson('/api/__ip')
            ->assertOk()
            ->assertJson(['ip' => '198.51.100.7']);
    }
}
