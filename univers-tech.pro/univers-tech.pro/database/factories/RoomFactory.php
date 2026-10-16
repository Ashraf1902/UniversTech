<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Room>
 */
class RoomFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => 'Room ' . $this->faker->unique()->bothify('?#-###'),
            'building' => $this->faker->randomElement(['Building A', 'Building B', 'Building C']),
            'capacity' => $this->faker->numberBetween(20, 120),
        ];
    }
}
