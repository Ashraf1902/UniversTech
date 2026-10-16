<?php

namespace Tests\Feature;

use App\Models\Admin;
use App\Models\Course;
use App\Models\Semester;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * A course must always belong to a semester so it appears in the correct term's
 * catalog and the enrollment / rollover logic can place it in a term.
 */
class CourseSemesterTest extends TestCase
{
    use RefreshDatabase;

    private Admin $admin;

    private Semester $semester;

    private User $professor;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = Admin::factory()->create(['is_super_admin' => true]);
        $this->semester = Semester::factory()->create();

        $this->professor = User::factory()->create([
            'type' => User::TYPE_PROFESSOR,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->admin->id,
            'department_id' => null,
            'level_id' => null,
        ]);

        Sanctum::actingAs($this->admin);
    }

    public function test_creating_a_course_requires_a_semester(): void
    {
        $response = $this->postJson('/api/course/store', [
            'course_name' => 'Alpha',
            'no_of_hours' => 3,
            'course_code' => 'AAA101',
            'professor_id' => $this->professor->id,
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors('semester_id', 'data');
        $this->assertDatabaseMissing('courses', ['course_code' => 'AAA101']);
    }

    public function test_creating_a_course_with_a_semester_succeeds(): void
    {
        $this->postJson('/api/course/store', [
            'course_name' => 'Alpha',
            'no_of_hours' => 3,
            'course_code' => 'AAA101',
            'professor_id' => $this->professor->id,
            'semester_id' => $this->semester->id,
        ])->assertStatus(201);

        $this->assertDatabaseHas('courses', [
            'course_code' => 'AAA101',
            'semester_id' => $this->semester->id,
        ]);
    }

    public function test_updating_a_course_requires_a_semester(): void
    {
        $course = $this->makeCourse();

        $this->postJson('/api/course/update', [
            'course_id' => $course->id,
            'course_name' => 'Renamed',
        ])->assertStatus(422)->assertJsonValidationErrors('semester_id', 'data');

        $this->assertDatabaseHas('courses', ['id' => $course->id, 'course_name' => 'Alpha']);
    }

    public function test_updating_a_course_with_a_semester_succeeds(): void
    {
        $course = $this->makeCourse();

        $this->postJson('/api/course/update', [
            'course_id' => $course->id,
            'course_name' => 'Renamed',
            'semester_id' => $this->semester->id,
        ])->assertOk();

        $this->assertDatabaseHas('courses', ['id' => $course->id, 'course_name' => 'Renamed']);
    }

    private function makeCourse(): Course
    {
        return Course::create([
            'course_name' => 'Alpha',
            'course_code' => 'AAA101',
            'no_of_hours' => 3,
            'capacity' => 10,
            'professor_id' => $this->professor->id,
            'admin_id' => $this->admin->id,
            'semester_id' => $this->semester->id,
        ]);
    }
}
