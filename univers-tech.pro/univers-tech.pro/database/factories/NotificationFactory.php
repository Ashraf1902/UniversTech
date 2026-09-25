<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Notification>
 */
class NotificationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition()
    {
        return [
            'title' => $this->faker->sentence,
            'content' => $this->faker->paragraph,
            'type' => 0,
        ];
    }

    public function event()
    {
        return $this->state(function (array $attributes) {
            return [
                'admin_id' => rand(1, 10),
                'image_path' => 'images/events/default.jpg',
                'type' => 1,
            ];
        });
    }

    public function notification()
    {
        return $this->state(function (array $attributes) {
            return [
                'student_id' => rand(1, 10),
                'professor_id' => rand(1, 10),
                'type' => 0,
            ];
        });
    }
}
