<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicMetaTest extends TestCase
{
    use RefreshDatabase;

    public function test_payment_demo_mode_is_reported_true_without_a_stripe_secret(): void
    {
        config([
            'services.stripe.demo_mode' => true,
            'services.stripe.secret' => null,
        ]);

        $this->getJson('/api/public/meta')
            ->assertOk()
            ->assertJsonPath('data.payment_demo_mode', true);
    }

    public function test_payment_demo_mode_is_reported_false_when_a_stripe_secret_is_configured(): void
    {
        config([
            'services.stripe.demo_mode' => true,
            'services.stripe.secret' => 'sk_test_placeholder',
        ]);

        $this->getJson('/api/public/meta')
            ->assertOk()
            ->assertJsonPath('data.payment_demo_mode', false);
    }
}
