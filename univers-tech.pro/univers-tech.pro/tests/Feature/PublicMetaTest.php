<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicMetaTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_banner_is_true_when_demo_flag_is_on_and_no_secret(): void
    {
        config(['services.stripe.demo_mode' => true, 'services.stripe.secret' => null]);

        $this->getJson('/api/public/meta')
            ->assertOk()
            ->assertJsonPath('data.payment_demo_mode', true);
    }

    public function test_demo_banner_is_false_when_the_flag_is_unset(): void
    {
        config(['services.stripe.demo_mode' => null, 'services.stripe.secret' => null]);

        $this->getJson('/api/public/meta')
            ->assertOk()
            ->assertJsonPath('data.payment_demo_mode', false);
    }

    public function test_demo_banner_is_false_when_demo_flag_is_on_but_a_secret_exists(): void
    {
        config(['services.stripe.demo_mode' => true, 'services.stripe.secret' => 'sk_test_dummy']);

        $this->getJson('/api/public/meta')
            ->assertOk()
            ->assertJsonPath('data.payment_demo_mode', false);
    }

    public function test_demo_banner_is_false_when_demo_flag_is_off_and_no_secret(): void
    {
        config(['services.stripe.demo_mode' => false, 'services.stripe.secret' => null]);

        $this->getJson('/api/public/meta')
            ->assertOk()
            ->assertJsonPath('data.payment_demo_mode', false);
    }

    public function test_demo_banner_is_false_when_demo_flag_is_off_and_a_secret_exists(): void
    {
        config(['services.stripe.demo_mode' => false, 'services.stripe.secret' => 'sk_test_dummy']);

        $this->getJson('/api/public/meta')
            ->assertOk()
            ->assertJsonPath('data.payment_demo_mode', false);
    }

    public function test_demo_banner_is_true_in_production(): void
    {
        $this->app['env'] = 'production';
        config(['services.stripe.demo_mode' => true, 'services.stripe.secret' => null]);

        $this->getJson('/api/public/meta')
            ->assertOk()
            ->assertJsonPath('data.payment_demo_mode', true);
    }
}
