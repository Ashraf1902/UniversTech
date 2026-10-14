<?php

namespace Tests\Feature;

use App\Mail\AccessRequestApprovedMail;
use App\Mail\AccessRequestRejectedMail;
use App\Models\AccessRequest;
use App\Models\Admin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccessRequestDecisionTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsAdmin(array $roles): Admin
    {
        $admin = Admin::factory()->create(['is_super_admin' => false, 'roles' => $roles]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function pendingRequest(array $attributes = []): AccessRequest
    {
        return AccessRequest::create(array_merge([
            'name' => 'Aya Applicant',
            'email' => 'aya@example.com',
            'password' => bcrypt('password'),
            'gender' => 1,
            'status' => AccessRequest::STATUS_PENDING,
        ], $attributes));
    }

    public function test_rejecting_a_request_requires_a_reason(): void
    {
        $this->actingAsAdmin(['access_requests']);
        $request = $this->pendingRequest();

        $this->postJson('/api/access-request/respond', [
            'id' => $request->id,
            'action' => 'refuse',
        ])->assertStatus(422);

        $this->assertSame(AccessRequest::STATUS_PENDING, $request->fresh()->status);
    }

    public function test_accepting_a_request_sends_an_approval_email(): void
    {
        Mail::fake();
        $this->actingAsAdmin(['access_requests']);
        $request = $this->pendingRequest();

        $this->postJson('/api/access-request/respond', [
            'id' => $request->id,
            'action' => 'accept',
        ])->assertOk();

        Mail::assertQueued(AccessRequestApprovedMail::class, function (AccessRequestApprovedMail $mail) use ($request) {
            return $mail->email === $request->email;
        });
    }

    public function test_rejecting_a_request_stores_the_reason_and_sends_a_rejection_email(): void
    {
        Mail::fake();
        $this->actingAsAdmin(['access_requests']);
        $request = $this->pendingRequest();

        $this->postJson('/api/access-request/respond', [
            'id' => $request->id,
            'action' => 'refuse',
            'reason' => 'Incomplete documents.',
        ])->assertOk();

        $fresh = $request->fresh();
        $this->assertSame(AccessRequest::STATUS_REFUSED, $fresh->status);
        $this->assertSame('Incomplete documents.', $fresh->rejection_reason);
        $this->assertNotNull($fresh->decided_at);

        Mail::assertQueued(AccessRequestRejectedMail::class, function (AccessRequestRejectedMail $mail) {
            return $mail->reason === 'Incomplete documents.';
        });
    }

    public function test_only_admins_with_the_access_requests_scope_can_respond(): void
    {
        $this->actingAsAdmin(['courses']);
        $request = $this->pendingRequest();

        $this->postJson('/api/access-request/respond', [
            'id' => $request->id,
            'action' => 'accept',
        ])->assertStatus(403);
    }
}
