<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Semester>
 */
class SemesterFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => 'Semester ' . $this->faker->unique()->numberBetween(1, 100000),
            'academic_year' => '2026-2027',
            'is_active' => false,
        ];
    }

    /**
     * The currently-running semester (registration window open).
     */
    public function active(): static
    {
        return $this->state(fn () => [
            'is_active' => true,
            'registration_opens_at' => now()->subWeek(),
            'registration_closes_at' => now()->addWeeks(2),
        ]);
    }
}
