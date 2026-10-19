<?php

namespace App\Http\Controllers\API\Student;

use App\Http\Controllers\Controller;
use App\Http\Resources\CourseCatalogResource;
use App\Http\Resources\CourseDetailResource;
use App\Http\Resources\LecturesResource;
use App\Http\Resources\StudentCourseResource;
use App\Models\Attendance;
use App\Models\Course;
use App\Models\Grade;
use App\Models\Lecture;
use App\Models\Payment;
use App\Models\Schedule;
use App\Models\Semester;
use App\Models\StudentCourse;
use App\Models\StudentLecture;
use App\Services\EnrollmentService;
use App\Support\ActivityLogger;
use App\Support\Settings;
use App\Support\UniversityTime;
use App\Traits\Notifiable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CoursesController extends Controller
{
    use Notifiable;

    public function __construct(private EnrollmentService $enrollment)
    {
    }

    public function myCourses()
    {
        $enrollments = auth()->user()->studentCourses()
            ->current()
            ->with(['course.professor', 'course.department', 'course.lectures'])
            ->latest()
            ->paginate(15);

        return SendResponse(200, 'Courses fetched successfully.', StudentCourseResource::collection($enrollments));
    }

    public function register(Request $request)
    {
        $data = $request->validate([
            'course_ids' => ['required', 'array', 'min:1'],
            'course_ids.*' => ['required', 'integer', 'exists:courses,id'],
        ]);

        $result = $this->enrollment->register(auth()->user(), $data['course_ids']);

        if (! $result['success']) {
            return SendResponse(422, $this->registrationMessage($result['errors']), [
                'registered' => [],
                'errors' => $result['errors'],
            ]);
        }

        return SendResponse(200, 'Courses registered successfully.', [
            'registered' => $result['registered'],
            'errors' => [],
        ]);
    }

    public function dropCourse(Request $request)
    {
        $data = $request->validate([
            'course_id' => ['required', 'integer', 'exists:courses,id'],
        ]);

        $course = Course::findOrFail($data['course_id']);

        $result = $this->enrollment->drop(auth()->user(), $course);

        if (! $result['success']) {
            $messages = [
                'not_registered' => 'You are not registered in this course.',
                'drop_window_closed' => 'The drop window for this semester has closed.',
            ];

            return SendResponse(422, $messages[$result['reason']] ?? 'Unable to drop the course.', [
                'reason' => $result['reason'],
            ]);
        }

        $this->flagRefundReview($course);

        return SendResponse(200, 'Course dropped successfully.');
    }

    /**
     * Flag a possible refund for admin review when a course is dropped (S4).
     * The payment is never refunded automatically.
     */
    private function flagRefundReview(Course $course): void
    {
        if (! Settings::flagRefundOnDrop()) {
            return;
        }

        $payment = auth()->user()->payments()
            ->where('type', Payment::TYPE_COURSES)
            ->whereIn('status', [Payment::STATUS_PAID, Payment::STATUS_WAIVED])
            ->whereYear('created_at', now()->year)
            ->latest()
            ->first();

        if (! $payment) {
            return;
        }

        ActivityLogger::log(
            ActivityLogger::PAYMENT_REFUND_REQUESTED,
            $payment,
            [
                'course_id' => $course->id,
                'course_name' => $course->course_name,
                'student_id' => auth()->id(),
            ],
            auth()->user(),
            'Course dropped; refund review requested.'
        );

        $this->notifyAllAdmins(
            'Refund review requested',
            auth()->user()->name . ' dropped "' . $course->course_name . '" and may be due a refund.'
        );
    }

    /**
     * Turn per-course failure reasons into a readable summary.
     *
     * @param  array<int, array<string, mixed>>  $errors
     */
    private function registrationMessage(array $errors): string
    {
        $names = Course::whereIn('id', array_filter(array_column($errors, 'course_id')))
            ->pluck('course_name', 'id');

        $reasons = [
            'registration_closed' => 'registration is currently closed',
            'not_found' => 'course not found',
            'already_registered' => 'already registered',
            'not_in_department' => 'not available for your department',
            'not_in_semester' => 'not offered in the active semester',
            'course_full' => 'course is full',
            'prerequisites_not_met' => 'prerequisites not met',
            'credit_limit_exceeded' => 'credit limit exceeded',
            'schedule_conflict' => 'schedule conflict with another course',
        ];

        $parts = [];

        foreach ($errors as $error) {
            $reason = $reasons[$error['reason']] ?? $error['reason'];
            $name = $error['course_id'] ? ($names[$error['course_id']] ?? ('#' . $error['course_id'])) : null;

            $parts[] = $name ? "{$name}: {$reason}" : $reason;
        }

        return 'Registration failed. ' . implode('; ', $parts) . '.';
    }

    public function showCourse(Request $request, $courseId)
    {
        $enrollment = StudentCourse::where('course_id', $courseId)
            ->where('student_id', auth()->id())
            ->registered()
            ->with(['course.professor', 'course.lectures', 'course.quizzes'])
            ->first();

        if (! $enrollment) {
            return SendResponse(404, 'Course not found.');
        }

        return SendResponse(200, 'Course fetched successfully.', new CourseDetailResource($enrollment));
    }

    public function showLecture(Request $request, $lectureId)
    {
        $lecture = Lecture::with('course')->find($lectureId);

        $ownsCourse = $lecture && StudentCourse::where('student_id', auth()->id())
            ->where('course_id', $lecture->course_id)
            ->registered()
            ->exists();

        if (! $ownsCourse) {
            return SendResponse(404, 'Lecture not found.');
        }

        return SendResponse(200, 'Lecture fetched successfully.', new LecturesResource($lecture));
    }

    public function updateProgress(Request $request)
    {
        $data = $request->validate([
            'course_id' => ['required', 'integer', 'exists:courses,id'],
            'lecture_id' => ['required', 'integer', 'exists:lectures,id'],
        ]);

        $enrollment = auth()->user()->studentCourses()
            ->registered()
            ->with('course.lectures')
            ->firstWhere('course_id', $data['course_id']);

        if (! $enrollment) {
            return SendResponse(404, 'You are not registered in this course.');
        }

        $lectureExists = $enrollment->course->lectures->contains('id', $data['lecture_id']);
        if (! $lectureExists) {
            return SendResponse(404, 'Lecture does not belong to this course.');
        }

        $watched = StudentLecture::firstOrCreate(
            [
                'student_id' => auth()->id(),
                'lecture_id' => $data['lecture_id'],
            ],
            [
                'course_id' => $data['course_id'],
                'watched_at' => now(),
            ]
        );

        if ($watched->wasRecentlyCreated) {
            $this->notifyProfessor(
                $enrollment->course->professor_id,
                'Lecture viewed',
                auth()->user()->name . ' watched "' . $enrollment->course->lectures->firstWhere('id', $data['lecture_id'])?->name
                    . '" in "' . $enrollment->course->course_name . '".',
                auth()->id()
            );
        }

        $progress = StudentLecture::where('student_id', auth()->id())
            ->where('course_id', $data['course_id'])
            ->count();

        $totalLectures = $enrollment->course->lectures->count();

        DB::transaction(function () use ($enrollment, $data, $progress) {
            $enrollment->update([
                'progress' => $progress,
                'last_lecture_id' => $data['lecture_id'],
            ]);
        });

        return SendResponse(200, 'Progress updated successfully.', [
            'progress' => $progress,
            'total_lectures' => $totalLectures,
            'new_lecture' => $watched->wasRecentlyCreated,
            'progress_percent' => $totalLectures > 0 ? round($progress / $totalLectures * 100) : 0,
        ]);
    }

    public function schedule(Request $request)
    {
        $user = auth()->user();

        $activeSemester = Semester::where('is_active', true)->first();

        // The timetable must match My Courses exactly: only the courses the
        // student is enrolled in for the active semester. This stops lectures
        // for courses the student is not registered in from leaking in just
        // because they share the student's level/department.
        if (! $activeSemester) {
            return SendResponse(200, 'Schedule fetched successfully.', ['schedule' => []]);
        }

        $courseIds = $user->studentCourses()
            ->current()
            ->pluck('course_id');

        $schedules = Schedule::where('semester_id', $activeSemester->id)
            ->whereIn('course_id', $courseIds)
            ->with('course')
            ->get()
            ->sortBy(fn (Schedule $schedule) => sprintf(
                '%02d|%s',
                Schedule::dayIndex($schedule->day_of_week),
                (string) $schedule->getRawOriginal('start_time')
            ))
            ->values()
            ->map(fn (Schedule $schedule) => [
                'id' => $schedule->id,
                'day_of_week' => $schedule->day_of_week,
                'start_time' => UniversityTime::time($schedule->getRawOriginal('start_time')),
                'end_time' => UniversityTime::time($schedule->getRawOriginal('end_time')),
                'section_type' => $schedule->section_type,
                'course_name' => $schedule->course?->course_name,
                'course_code' => $schedule->course?->course_code,
                'path' => $schedule->path ? url('uploads/' . $schedule->path) : null,
            ]);

        return SendResponse(200, 'Schedule fetched successfully.', ['schedule' => $schedules]);
    }

    public function reports()
    {
        $courses = auth()->user()->studentCourses()
            ->where('status', '!=', StudentCourse::STATUS_DROPPED)
            ->with(['course.professor', 'course.department'])
            ->get()
            ->map(function (StudentCourse $enrollment) {
                $attendances = Attendance::where('student_id', auth()->id())
                    ->where('course_id', $enrollment->course_id)
                    ->get();

                return [
                    'course_name' => $enrollment->course->course_name,
                    'progress' => $enrollment->progress,
                    'total_lectures' => $enrollment->course->lectures()->count(),
                    'attendance_count' => $attendances->count(),
                    'present' => $attendances->where('status', true)->count(),
                    'absent' => $attendances->where('status', false)->count(),
                ];
            });

        $grades = Grade::where('student_id', auth()->id())
            ->visible()
            ->with(['course.gradeComponents', 'semester', 'componentScores'])
            ->orderBy('created_at')
            ->get();

        $semesterCards = $grades
            ->groupBy(fn (Grade $grade) => $grade->semester_id ?? 'unassigned')
            ->map(function ($semesterGrades, $key) {
                $first = $semesterGrades->first();
                $semester = $first->semester;

                return [
                    'semester' => $semester ? [
                        'id' => $semester->id,
                        'name' => $semester->name,
                        'academic_year' => $semester->academic_year,
                        'grading_system' => $semester->grading_system,
                    ] : [
                        'id' => null,
                        'name' => 'Unassigned semester',
                        'academic_year' => null,
                        'grading_system' => 'gpa',
                    ],
                    'courses' => $semesterGrades->map(fn (Grade $grade) => $this->reportGradeRow($grade)),
                    'final_score' => $this->reportSemesterScore($semesterGrades, $semester),
                ];
            })
            ->values();

        $graded = $grades->filter(fn (Grade $grade) => $grade->course && $grade->course->no_of_hours > 0);
        $totalCredit = $graded->sum(fn (Grade $grade) => $grade->course->no_of_hours);

        $qualityPoints = $graded->sum(function (Grade $grade) {
            $percentage = $grade->max_marks > 0 ? $grade->marks / $grade->max_marks * 100 : 0;

            return Grade::percentageToGpa($percentage)['gpa_points'] * $grade->course->no_of_hours;
        });

        $cumulativeGpa = $totalCredit > 0 ? round($qualityPoints / $totalCredit, 2) : null;

        return SendResponse(200, 'Report fetched successfully.', [
            'user' => auth()->user()->name,
            'year' => auth()->user()->level?->name,
            'department' => auth()->user()->department?->name,
            'courses' => $courses,
            'semester_cards' => $semesterCards,
            'overall' => [
                'total_graded_courses' => $graded->count(),
                'total_credit_hours' => $totalCredit,
                'cumulative_gpa' => $cumulativeGpa,
                'rate' => $cumulativeGpa !== null ? Grade::gpaToLetter($cumulativeGpa) : null,
            ],
        ]);
    }

    private function reportGradeRow(Grade $grade): array
    {
        $percentage = $grade->max_marks > 0 ? round($grade->marks / $grade->max_marks * 100, 2) : 0;
        $gpaRow = Grade::percentageToGpa($percentage);

        $components = $grade->course?->gradeComponents ?? collect();

        return [
            'course_id' => $grade->course_id,
            'course_name' => $grade->course?->course_name,
            'course_code' => $grade->course?->course_code,
            'credit_hours' => $grade->course?->no_of_hours,
            'marks' => $grade->marks,
            'max_marks' => $grade->max_marks,
            'percentage' => $percentage,
            'gpa_points' => $gpaRow['gpa_points'],
            'rate' => $gpaRow['letter_grade'],
            'status' => $grade->status,
            'components' => $components->isNotEmpty()
                ? $components->map(function ($component) use ($grade) {
                    $score = $grade->componentScores->firstWhere('grade_component_id', $component->id);

                    return [
                        'name' => $component->name,
                        'weight' => (float) $component->weight,
                        'marks' => $score ? (float) $score->marks : null,
                        'max_marks' => $score ? (float) $score->max_marks : null,
                        'percentage' => $score ? $score->percentage() : null,
                    ];
                })->values()->all()
                : [],
        ];
    }

    private function reportSemesterScore($semesterGrades, ?Semester $semester): array
    {
        $totalCredit = $semesterGrades->sum(fn (Grade $grade) => $grade->course?->no_of_hours ?? 0);

        $qualityPoints = $semesterGrades->sum(function (Grade $grade) {
            $percentage = $grade->max_marks > 0 ? $grade->marks / $grade->max_marks * 100 : 0;

            return Grade::percentageToGpa($percentage)['gpa_points'] * ($grade->course?->no_of_hours ?? 0);
        });

        $system = $semester?->grading_system ?? 'gpa';

        if ($system === 'fixed_term') {
            $percentage = $semesterGrades->avg(function (Grade $grade) {
                return $grade->max_marks > 0 ? $grade->marks / $grade->max_marks * 100 : 0;
            });

            return [
                'type' => 'fixed_term',
                'percentage' => round($percentage, 2),
                'gpa' => null,
                'rate' => Grade::percentageToGpa($percentage)['letter_grade'],
            ];
        }

        $gpa = $totalCredit > 0 ? round($qualityPoints / $totalCredit, 2) : 0;

        return [
            'type' => 'gpa',
            'percentage' => null,
            'gpa' => $gpa,
            'rate' => Grade::gpaToLetter($gpa),
        ];
    }

    public function allCourses()
    {
        $user = auth()->user();
        $activeSemester = Semester::where('is_active', true)->first();

        $query = Course::with(['professor', 'prerequisites:id,course_name,course_code'])->orderBy('course_name');

        if ($user->student?->department_id) {
            $query->where(function ($q) use ($user) {
                $q->whereNull('department_id')
                    ->orWhere('department_id', $user->student?->department_id);
            });
        } else {
            $query->whereNull('department_id');
        }

        if ($activeSemester) {
            $query->where(function ($q) use ($activeSemester) {
                $q->whereNull('semester_id')
                    ->orWhere('semester_id', $activeSemester->id);
            });
        }

        $courses = $query->paginate(15);

        $ids = collect($courses->items())->pluck('id');

        $counts = StudentCourse::whereIn('course_id', $ids)
            ->registered()
            ->selectRaw('course_id, count(*) as aggregate')
            ->groupBy('course_id')
            ->pluck('aggregate', 'course_id');

        $registered = StudentCourse::where('student_id', $user->id)
            ->whereIn('course_id', $ids)
            ->registered()
            ->pluck('course_id')
            ->flip();

        $registrationOpen = (bool) ($activeSemester && $activeSemester->registrationOpen());

        foreach ($courses as $course) {
            $enrolled = (int) ($counts[$course->id] ?? 0);

            $course->setAttribute('enrolled_count', $enrolled);
            $course->setAttribute('seats_remaining', $course->capacity === null ? null : max($course->capacity - $enrolled, 0));
            $course->setAttribute('already_registered', isset($registered[$course->id]));
            $course->setAttribute('registration_open', $registrationOpen);
            $course->setAttribute('credit_limit', Settings::creditLimit());
            $course->setAttribute('drop_window_days', Settings::dropWindowDays());
        }

        return SendResponse(200, 'Courses fetched successfully.', CourseCatalogResource::collection($courses));
    }
}
