<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\User>
 */
class UserFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array
     */
    public function definition()
    {
        return [
            'name' => $this->faker->name(),
            'email' => $this->faker->unique()->safeEmail(),
            'password' => bcrypt('password'),
            'gender' => rand(0,1),
            'nationalid'=>rand(302000000000,302999999999),
            'phone' => '0'.$this->faker->numberBetween(1000000000,1599999999),
            'credit_points'=>rand(12,38),
            'semester'=>$this->faker->randomElement(['first','second']),
            'type'=>rand(0,1),
            'admin_id'=>rand(1,10),
            'department_id'=>rand(1,10),
            'level_id'=>rand(1,10),
        ];
    }

    /**
     * Indicate that the model's email address should be unverified.
     *
     * @return \Illuminate\Database\Eloquent\Factories\Factory
     */
    public function unverified()
    {
        return $this->state(function (array $attributes) {
            return [
                'email_verified_at' => null,
            ];
        });
    }
}
