<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Course>
 */
class CourseFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition()
    {
        $professors = User::where('type', true)->pluck('id')->toArray();
        return [
            'course_name' => $this->faker->sentence(2),
            'no_of_hours' => $this->faker->numberBetween(1, 4),
            'course_code' => $this->faker->unique()->randomNumber(5),
            'cover_image' => $this->faker->sentence(2).'.jpg',
            'department_id' => $this->faker->numberBetween(1, 10),
            'professor_id' => $this->faker->randomElement($professors),
            'admin_id' => $this->faker->numberBetween(1, 10),
        ];
    }
}
