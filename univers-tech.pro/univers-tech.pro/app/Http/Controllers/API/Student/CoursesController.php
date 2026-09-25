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
use App\Models\Schedule;
use App\Models\Semester;
use App\Models\StudentCourse;
use App\Models\StudentLecture;
use App\Traits\Notifiable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CoursesController extends Controller
{
    use Notifiable;

    public function myCourses()
    {
        $enrollments = auth()->user()->studentCourses()
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

        $user = auth()->user();
        $activeSemester = Semester::where('is_active', true)->first();

        $alreadyRegistered = [];
        $newlyRegistered = [];
        $rejected = [];

        DB::transaction(function () use ($user, $data, $activeSemester, &$alreadyRegistered, &$newlyRegistered, &$rejected) {
            foreach ($data['course_ids'] as $courseId) {
                $course = Course::find($courseId);

                $inDepartment = $course->department_id === $user->department_id
                    || ($user->department_id && $course->department_id === null)
                    || (! $user->department_id && $course->department_id === null);

                $inSemester = $course->semester_id === null
                    || ($activeSemester && $course->semester_id === $activeSemester->id);

                if (! $inDepartment || ! $inSemester) {
                    $rejected[] = $course->course_name;
                    continue;
                }

                $exists = StudentCourse::where('student_id', auth()->id())
                    ->where('course_id', $courseId)
                    ->exists();

                if ($exists) {
                    $alreadyRegistered[] = $courseId;
                    continue;
                }

                StudentCourse::create([
                    'student_id' => auth()->id(),
                    'course_id' => $courseId,
                ]);
                $newlyRegistered[] = $courseId;
            }
        });

        $message = 'Courses registration completed.';

        if (! empty($rejected)) {
            $message .= ' Rejected (not in your semester/department): ' . implode(', ', $rejected) . '.';
        }

        if (! empty($alreadyRegistered)) {
            $message .= ' Already registered: ' . implode(', ', $alreadyRegistered) . '.';
        }

        return SendResponse(200, $message, [
            'registered' => $newlyRegistered,
            'already_registered' => $alreadyRegistered,
            'rejected' => $rejected,
        ]);
    }

    public function showCourse(Request $request, $courseId)
    {
        $enrollment = StudentCourse::where('course_id', $courseId)
            ->where('student_id', auth()->id())
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

        $query = Schedule::where('level_id', $user->level_id)
            ->with('course');

        if ($activeSemester) {
            $query->where('semester_id', $activeSemester->id);
        }

        if ($user->department_id) {
            $query->where(function ($q) use ($user) {
                $q->whereNull('department_id')
                    ->orWhere('department_id', $user->department_id);
            });
        }

        $schedules = $query
            ->orderBy('day_of_week')
            ->orderBy('start_time')
            ->get()
            ->map(fn (Schedule $schedule) => [
                'id' => $schedule->id,
                'day_of_week' => $schedule->day_of_week,
                'start_time' => $schedule->start_time,
                'end_time' => $schedule->end_time,
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
            ->with(['course', 'semester'])
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

        $query = Course::with('professor')->orderBy('course_name');

        if ($user->department_id) {
            $query->where(function ($q) use ($user) {
                $q->whereNull('department_id')
                    ->orWhere('department_id', $user->department_id);
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

        return SendResponse(200, 'Courses fetched successfully.', CourseCatalogResource::collection($courses));
    }
}
