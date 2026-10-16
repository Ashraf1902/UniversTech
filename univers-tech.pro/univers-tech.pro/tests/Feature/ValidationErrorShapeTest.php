<?php

namespace Tests\Feature;

use App\Models\Admin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Locks the validation-error contract: every API validation failure, whether it
 * comes from a FormRequest using the FetchRequestError trait or from an inline
 * $request->validate() call, must return HTTP 422 with the same envelope:
 *
 *   { status: 422, message: "error in body request", data: { field: [ ... ] } }
 *
 * The frontend request wrapper (src/lib/api.js) reads `data` to surface the
 * first field message, so both paths must agree on this shape.
 */
class ValidationErrorShapeTest extends TestCase
{
    use RefreshDatabase;

    public function test_form_request_validation_uses_the_standard_envelope(): void
    {
        $this->postJson('/api/auth/login', [])
            ->assertStatus(422)
            ->assertJsonPath('status', 422)
            ->assertJsonPath('message', 'error in body request')
            ->assertJsonValidationErrors('email', 'data');
    }

    public function test_inline_validation_uses_the_same_envelope(): void
    {
        $admin = Admin::factory()->create(['is_super_admin' => true]);
        Sanctum::actingAs($admin);

        $this->postJson('/api/course/enrollment/enroll', [])
            ->assertStatus(422)
            ->assertJsonPath('status', 422)
            ->assertJsonPath('message', 'error in body request')
            ->assertJsonValidationErrors('course_id', 'data')
            ->assertJsonValidationErrors('student_id', 'data');
    }

    public function test_inline_and_form_request_bodies_have_identical_keys(): void
    {
        $formRequest = $this->postJson('/api/auth/login', [])->json();

        $admin = Admin::factory()->create(['is_super_admin' => true]);
        Sanctum::actingAs($admin);
        $inline = $this->postJson('/api/course/enrollment/enroll', [])->json();

        $this->assertSame(['status', 'message', 'data'], array_keys($formRequest));
        $this->assertSame(array_keys($formRequest), array_keys($inline));

        $this->assertIsArray($formRequest['data']);
        $this->assertIsArray($inline['data']);
    }
}
