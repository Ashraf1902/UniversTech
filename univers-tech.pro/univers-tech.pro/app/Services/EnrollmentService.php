<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Grade;
use App\Models\Schedule;
use App\Models\Semester;
use App\Models\StudentCourse;
use App\Models\User;
use App\Support\ActivityLogger;
use App\Support\ScheduleOverlap;
use App\Support\Settings;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Applies the course-registration policy (S1) and performs atomic batch
 * enrollment (X3).
 *
 * Rules enforced for students: the registration window must be open, the
 * course must belong to the student's department & active semester, the
 * course capacity must have a free seat, prerequisites must be passed, the
 * credit limit must not be exceeded and the course schedule must not clash
 * with an already-registered course. A batch is all-or-nothing: if any course
 * fails, nothing is written and the response lists exactly which course failed
 * and why.
 *
 * Admins may bypass every rule with an explicit override (A4).
 */
class EnrollmentService
{
    public function activeSemester(): ?Semester
    {
        return Semester::where('is_active', true)->first();
    }

    /**
     * Register a batch of courses for a student.
     *
     * @param  array<int, int|string>  $courseIds
     * @param  array{override?: bool, actor?: Model|null, note?: string|null}  $options
     * @return array{success: bool, registered: array<int, int>, errors: array<int, array<string, mixed>>}
     */
    public function register(User $student, array $courseIds, array $options = []): array
    {
        $override = (bool) ($options['override'] ?? false);
        $actor = $options['actor'] ?? null;
        $note = $options['note'] ?? null;

        $courseIds = array_values(array_unique(array_map('intval', $courseIds)));

        return DB::transaction(function () use ($student, $courseIds, $override, $actor, $note) {
            $semester = $this->activeSemester();

            $errors = [];

            if (! $override && (! $semester || ! $semester->registrationOpen())) {
                return [
                    'success' => false,
                    'registered' => [],
                    'errors' => [['course_id' => null, 'reason' => 'registration_closed']],
                ];
            }

            $courses = Course::whereIn('id', $courseIds)
                ->when(! $override, fn ($q) => $q->lockForUpdate())
                ->get()
                ->keyBy('id');

            foreach ($courseIds as $id) {
                if (! $courses->has($id)) {
                    $errors[] = ['course_id' => $id, 'reason' => 'not_found'];
                }
            }

            $existing = StudentCourse::where('student_id', $student->id)
                ->whereIn('course_id', $courseIds)
                ->get()
                ->keyBy('course_id');

            $registeredIds = StudentCourse::where('student_id', $student->id)
                ->registered()
                ->pluck('course_id')
                ->all();

            $usedCredits = StudentCourse::where('student_id', $student->id)
                ->registered()
                ->with('course:id,no_of_hours')
                ->get()
                ->sum(fn (StudentCourse $e) => $e->course?->no_of_hours ?? 0);

            $existingSlots = $this->slotsForCourseIds($registeredIds);
            $batchSlots = [];
            $batchCredits = 0;

            foreach ($courseIds as $id) {
                if (! $courses->has($id)) {
                    continue;
                }

                $course = $courses->get($id);
                $existingEnrollment = $existing->get($id);

                if ($existingEnrollment && $existingEnrollment->status !== StudentCourse::STATUS_DROPPED) {
                    $errors[] = ['course_id' => $id, 'reason' => 'already_registered'];
                    continue;
                }

                if ($override) {
                    continue;
                }

                if (! $this->departmentEligible($student, $course)) {
                    $errors[] = ['course_id' => $id, 'reason' => 'not_in_department'];
                    continue;
                }

                if (! $this->semesterEligible($course, $semester)) {
                    $errors[] = ['course_id' => $id, 'reason' => 'not_in_semester'];
                    continue;
                }

                if ($course->capacity !== null && $this->enrolledCount($course) >= $course->capacity) {
                    $errors[] = ['course_id' => $id, 'reason' => 'course_full'];
                    continue;
                }

                $missing = $this->missingPrerequisites($student, $course);
                if (! empty($missing)) {
                    $errors[] = ['course_id' => $id, 'reason' => 'prerequisites_not_met', 'prerequisites' => $missing];
                    continue;
                }

                $limit = Settings::creditLimit();
                if ($limit > 0 && ($usedCredits + $batchCredits + $course->no_of_hours) > $limit) {
                    $errors[] = ['course_id' => $id, 'reason' => 'credit_limit_exceeded', 'limit' => $limit];
                    continue;
                }

                $slots = $this->slotsForCourseIds([$id]);
                $conflict = $this->findConflict($slots, array_merge($existingSlots, $batchSlots));
                if ($conflict) {
                    $errors[] = ['course_id' => $id, 'reason' => 'schedule_conflict', 'conflicts_with' => $conflict];
                    continue;
                }

                $batchSlots = array_merge($batchSlots, $slots);
                $batchCredits += $course->no_of_hours;
            }

            if (! empty($errors)) {
                return ['success' => false, 'registered' => [], 'errors' => $errors];
            }

            $registered = [];

            foreach ($courseIds as $id) {
                $course = $courses->get($id);
                $existingEnrollment = $existing->get($id);

                if ($existingEnrollment && $existingEnrollment->status === StudentCourse::STATUS_DROPPED) {
                    $existingEnrollment->changeStatus(StudentCourse::STATUS_REGISTERED, $actor, [
                        'semester_id' => $existingEnrollment->semester_id ?? $course->semester_id ?? $semester?->id,
                        'reactivated' => true,
                        'override' => $override,
                    ]);
                } else {
                    $enrollment = StudentCourse::create([
                        'student_id' => $student->id,
                        'course_id' => $id,
                        'status' => StudentCourse::STATUS_REGISTERED,
                        'status_changed_at' => now(),
                        'semester_id' => $course->semester_id ?? $semester?->id,
                    ]);

                    if ($override) {
                        ActivityLogger::log(
                            ActivityLogger::ENROLLMENT_STATUS_CHANGED,
                            $enrollment,
                            [
                                'from' => null,
                                'to' => StudentCourse::STATUS_REGISTERED,
                                'override' => true,
                                'note' => $note,
                                'admin_id' => $actor?->getKey(),
                            ],
                            $actor,
                            'Admin override enrollment.'
                        );
                    }
                }

                $registered[] = $id;
            }

            return ['success' => true, 'registered' => $registered, 'errors' => []];
        });
    }

    /**
     * Drop (withdraw from) a course. Students must be inside the withdrawal
     * window; admins may override.
     *
     * @param  array{override?: bool, actor?: Model|null, note?: string|null}  $options
     * @return array{success: bool, reason?: string}
     */
    public function drop(User $student, Course $course, array $options = []): array
    {
        $override = (bool) ($options['override'] ?? false);
        $actor = $options['actor'] ?? null;
        $note = $options['note'] ?? null;

        $enrollment = StudentCourse::where('student_id', $student->id)
            ->where('course_id', $course->id)
            ->first();

        if (! $enrollment || $enrollment->status !== StudentCourse::STATUS_REGISTERED) {
            return ['success' => false, 'reason' => 'not_registered'];
        }

        if (! $override && ! $this->insideDropWindow($enrollment)) {
            return ['success' => false, 'reason' => 'drop_window_closed'];
        }

        $enrollment->changeStatus(StudentCourse::STATUS_DROPPED, $actor, [
            'override' => $override,
            'note' => $note,
        ]);

        return ['success' => true];
    }

    public function insideDropWindow(StudentCourse $enrollment): bool
    {
        $semester = $enrollment->semester ?? $this->activeSemester();

        if (! $semester) {
            return true;
        }

        $base = $semester->registration_closes_at ?? $enrollment->status_changed_at ?? $enrollment->created_at;

        if (! $base) {
            return true;
        }

        $days = Settings::dropWindowDays();

        return now()->lte($base->copy()->addDays($days));
    }

    public function departmentEligible(User $student, Course $course): bool
    {
        $departmentId = $student->student?->department_id;

        return $course->department_id === $departmentId
            || ($departmentId && $course->department_id === null)
            || (! $departmentId && $course->department_id === null);
    }

    public function semesterEligible(Course $course, ?Semester $semester): bool
    {
        return $course->semester_id === null
            || ($semester && $course->semester_id === $semester->id);
    }

    public function enrolledCount(Course $course): int
    {
        return StudentCourse::where('course_id', $course->id)
            ->registered()
            ->count();
    }

    public function seatsRemaining(Course $course): ?int
    {
        if ($course->capacity === null) {
            return null;
        }

        return max($course->capacity - $this->enrolledCount($course), 0);
    }

    /**
     * Prerequisites the student has not yet passed (by grade percentage).
     *
     * @return array<int, array<string, mixed>>
     */
    public function missingPrerequisites(User $student, Course $course): array
    {
        $passing = Settings::passingScore();

        $missing = [];

        foreach ($course->prerequisites as $prerequisite) {
            $passingGrade = Grade::where('student_id', $student->id)
                ->where('course_id', $prerequisite->id)
                ->get()
                ->contains(function (Grade $grade) use ($passing) {
                    $max = (float) $grade->max_marks;

                    return $max > 0 && ((float) $grade->marks / $max * 100) >= $passing;
                });

            if (! $passingGrade) {
                $missing[] = [
                    'id' => $prerequisite->id,
                    'course_name' => $prerequisite->course_name,
                    'course_code' => $prerequisite->course_code,
                ];
            }
        }

        return $missing;
    }

    /**
     * All schedule slots belonging to the given courses (active semester).
     *
     * @param  array<int, int>  $courseIds
     * @return array<int, array<string, mixed>>
     */
    protected function slotsForCourseIds(array $courseIds): array
    {
        if (empty($courseIds)) {
            return [];
        }

        return Schedule::whereIn('course_id', $courseIds)
            ->get(['course_id', 'day_of_week', 'start_time', 'end_time'])
            ->map(fn (Schedule $schedule) => [
                'course_id' => $schedule->course_id,
                'day_of_week' => $schedule->day_of_week,
                'start_time' => $schedule->start_time,
                'end_time' => $schedule->end_time,
            ])
            ->all();
    }

    /**
     * @param  array<int, array<string, mixed>>  $candidate
     * @param  array<int, array<string, mixed>>  $existing
     * @return array<string, mixed>|null
     */
    protected function findConflict(array $candidate, array $existing): ?array
    {
        foreach ($candidate as $slot) {
            foreach ($existing as $other) {
                if ($slot['course_id'] == $other['course_id']) {
                    continue;
                }

                if (ScheduleOverlap::conflicts($slot, $other)) {
                    return [
                        'course_id' => $other['course_id'],
                        'day_of_week' => $other['day_of_week'],
                        'start_time' => $other['start_time'],
                        'end_time' => $other['end_time'],
                    ];
                }
            }
        }

        return null;
    }
}
