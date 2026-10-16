<?php

namespace Database\Seeders;

use App\Models\AccessRequest;
use App\Models\Admin;
use App\Models\Announcement;
use App\Models\Attendance;
use App\Models\AttendanceThresholdAlert;
use App\Models\Course;
use App\Models\Department;
use App\Models\Event;
use App\Models\Grade;
use App\Models\GradeAppeal;
use App\Models\GradeComponent;
use App\Models\GradeComponentScore;
use App\Models\Lecture;
use App\Models\Level;
use App\Models\Notification;
use App\Models\Payment;
use App\Models\Professor;
use App\Models\Quiz;
use App\Models\QuizSubmission;
use App\Models\Room;
use App\Models\Schedule;
use App\Models\Semester;
use App\Models\Setting;
use App\Models\Student;
use App\Models\StudentCourse;
use App\Models\StudentLecture;
use App\Models\StudentPromotion;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public const DEMO_PASSWORD = 'Demo@12345';

    public const DEMO_ACCOUNTS = [
        ['Super Admin', 'superadmin@universtech.demo', 'super admin (all scopes)'],
        ['Registrar', 'registrar@universtech.demo', 'accounts, courses, schedules, semesters, grades, attendances, departments, reports, settings'],
        ['Finance', 'finance@universtech.demo', 'payments, reports'],
        ['Events & Support', 'events@universtech.demo', 'events, access_requests, activity'],
        ['Prof. Ahmed Hassan', 'professor@universtech.demo', 'professor'],
        ['Student Demo', 'student@universtech.demo', 'student'],
    ];

    private Admin $super;

    private Semester $semester;

    private Semester $upcomingSemester;

    private Semester $pastSemester;

    /** @var array<int, Level> */
    private array $levels = [];

    /** @var array<int, Department> */
    private array $departments = [];

    /** @var array<int, Room> */
    private array $rooms = [];

    /** @var array<int, User> */
    private array $professorUsers = [];

    /** @var array<int, User> */
    private array $studentUsers = [];

    /** @var array<int, Course> */
    private array $courses = [];

    private int $userCounter = 0;

    public function run(): void
    {
        $this->super = $this->seedAdmins();
        $this->seedLevels();
        $this->departments = $this->seedDepartments();
        [$this->semester, $this->upcomingSemester, $this->pastSemester] = $this->seedSemesters();
        $this->seedSettings();
        $this->rooms = $this->seedRooms();
        $this->professorUsers = $this->seedProfessors();
        $this->studentUsers = $this->seedStudents();
        $this->courses = $this->seedCourses();
        $this->seedPrerequisites();
        $this->seedSchedules();
        $this->seedStudentCourses();
        $this->seedLecturesAndProgress();
        $this->seedGrades();
        $this->seedQuizzes();
        $this->seedAnnouncements();
        $this->seedAttendance();
        $this->seedPayments();
        $this->seedEventsAndNotifications();
        $this->seedAccessRequests();
        $this->seedPromotions();

        $this->listDemoAccounts();
    }

    private function seedAdmins(): Admin
    {
        $super = Admin::updateOrCreate(['email' => 'superadmin@universtech.demo'], [
            'name' => 'Super Admin',
            'password' => Hash::make(self::DEMO_PASSWORD),
            'is_super_admin' => true,
            'roles' => null,
        ]);

        $admins = [
            ['registrar@universtech.demo', 'Registrar', ['accounts', 'courses', 'schedules', 'semesters', 'grades', 'attendances', 'departments', 'reports', 'settings']],
            ['finance@universtech.demo', 'Finance', ['payments', 'reports']],
            ['events@universtech.demo', 'Events & Support', ['events', 'access_requests', 'activity']],
        ];

        foreach ($admins as [$email, $name, $roles]) {
            Admin::updateOrCreate(['email' => $email], [
                'name' => $name,
                'password' => Hash::make(self::DEMO_PASSWORD),
                'is_super_admin' => false,
                'roles' => $roles,
            ]);
        }

        return $super;
    }

    private function seedLevels(): void
    {
        foreach (['Level 1', 'Level 2', 'Level 3', 'Level 4'] as $index => $name) {
            $this->levels[] = Level::updateOrCreate(['name' => $name], ['position' => $index + 1]);
        }
    }

    /**
     * @return array<int, Department>
     */
    private function seedDepartments(): array
    {
        $departments = [];

        foreach ([['Computer Science', 'CS'], ['Information Technology', 'IT'], ['Business Administration', 'BA'], ['Software Engineering', 'SE']] as [$name, $abbr]) {
            $departments[] = Department::updateOrCreate(['name' => $name], [
                'abbrevation' => $abbr,
                'admin_id' => $this->super->id,
            ]);
        }

        return $departments;
    }

    /**
     * @return array{0: Semester, 1: Semester, 2: Semester}
     */
    private function seedSemesters(): array
    {
        $active = Semester::updateOrCreate(['name' => 'First Semester 2026/2027'], [
            'academic_year' => '2026/2027',
            'is_active' => true,
            'registration_opens_at' => now()->subWeek(),
            'registration_closes_at' => now()->addWeeks(2),
        ]);

        $upcoming = Semester::updateOrCreate(['name' => 'Second Semester 2026/2027'], [
            'academic_year' => '2026/2027',
            'is_active' => false,
            'registration_opens_at' => now()->addMonths(3),
            'registration_closes_at' => now()->addMonths(4),
        ]);

        $past = Semester::updateOrCreate(['name' => 'Second Semester 2025/2026'], [
            'academic_year' => '2025/2026',
            'is_active' => false,
            'closed_at' => now()->subMonths(2),
        ]);

        return [$active, $upcoming, $past];
    }

    private function seedSettings(): void
    {
        $defaults = [
            'credit_limit' => 18,
            'passing_score' => 50,
            'drop_window_days' => 14,
            'grade_edit_window_hours' => 48,
            'attendance_edit_window_hours' => 48,
            'attendance_warn_threshold' => 15,
            'attendance_bar_threshold' => 25,
            'appeal_window_days' => 14,
            'quiz_allow_resubmit' => false,
            'quiz_allow_late' => false,
            'quiz_submission_max_kb' => 10240,
            'flag_refund_on_drop' => true,
        ];

        foreach ($defaults as $key => $value) {
            Setting::updateOrCreate(['key' => $key], ['value' => $value]);
        }
    }

    /**
     * @return array<int, Room>
     */
    private function seedRooms(): array
    {
        $specs = [
            ['A-101', 'Building A', 60],
            ['A-102', 'Building A', 45],
            ['B-201', 'Building B', 80],
            ['B-202', 'Building B', 80],
            ['C-301', 'Building C', 120],
            ['Lab-1', 'Building C', 40],
        ];

        $rooms = [];

        foreach ($specs as [$name, $building, $capacity]) {
            $rooms[] = Room::updateOrCreate(['name' => $name, 'building' => $building], ['capacity' => $capacity]);
        }

        return $rooms;
    }

    /**
     * @return array<int, User>
     */
    private function seedProfessors(): array
    {
        $specs = [
            ['professor@universtech.demo', 'Prof. Ahmed Hassan', 0],
            ['mona.ali@universtech.demo', 'Dr. Mona Ali', 1],
            ['omar.khaled@universtech.demo', 'Dr. Omar Khaled', 2],
            ['sara.mostafa@universtech.demo', 'Dr. Sara Mostafa', 3],
        ];

        $users = [];

        foreach ($specs as [$email, $name, $deptIndex]) {
            $user = $this->makeUser($email, $name, User::TYPE_PROFESSOR, $deptIndex, null);
            Professor::updateOrCreate(['user_id' => $user->id], [
                'department_id' => $this->departments[$deptIndex]->id,
                'job_title' => $name,
            ]);
            $users[] = $user;
        }

        return $users;
    }

    /**
     * @return array<int, User>
     */
    private function seedStudents(): array
    {
        $specs = [
            ['student@universtech.demo', 'Student Demo', 0, 0],
            ['laila.hassan@universtech.demo', 'Laila Hassan', 1, 1],
            ['mohamed.salah@universtech.demo', 'Mohamed Salah', 2, 2],
            ['nour.eldin@universtech.demo', 'Nour El-Din', 3, 3],
            ['youssef.adel@universtech.demo', 'Youssef Adel', 0, 0],
            ['farah.ibrahim@universtech.demo', 'Farah Ibrahim', 1, 1],
            ['omar.tarek@universtech.demo', 'Omar Tarek', 2, 2],
            ['hana.mahmoud@universtech.demo', 'Hana Mahmoud', 3, 3],
            ['ziad.sherif@universtech.demo', 'Ziad Sherif', 0, 0],
            ['mariam.khaled@universtech.demo', 'Mariam Khaled', 1, 1],
        ];

        $users = [];

        foreach ($specs as [$email, $name, $deptIndex, $levelIndex]) {
            $user = $this->makeUser($email, $name, User::TYPE_STUDENT, $deptIndex, $levelIndex);
            Student::updateOrCreate(['user_id' => $user->id], [
                'department_id' => $this->departments[$deptIndex]->id,
                'level_id' => $this->levels[$levelIndex]->id,
                'semester' => 'first',
                'credit_points' => rand(12, 38),
            ]);
            $users[] = $user;
        }

        return $users;
    }

    private function makeUser(string $email, string $name, int $type, int $departmentIndex, ?int $levelIndex): User
    {
        $this->userCounter++;

        return User::updateOrCreate(['email' => $email], [
            'name' => $name,
            'password' => Hash::make(self::DEMO_PASSWORD),
            'gender' => $this->userCounter % 2,
            'nationalid' => '302' . str_pad((string) $this->userCounter, 11, '0', STR_PAD_LEFT),
            'phone' => '010' . str_pad((string) $this->userCounter, 8, '0', STR_PAD_LEFT),
            'credit_points' => rand(12, 38),
            'semester' => 'first',
            'type' => $type,
            'status' => User::STATUS_ACTIVE,
            'admin_id' => $this->super->id,
            'department_id' => $this->departments[$departmentIndex]->id,
            'level_id' => $levelIndex === null ? null : $this->levels[$levelIndex]->id,
        ]);
    }

    /**
     * @return array<int, Course>
     */
    private function seedCourses(): array
    {
        $specs = [
            ['Database Systems', 'CS203', 3, 60, 0, 0],
            ['Data Structures', 'CS201', 3, 60, 0, 1],
            ['Operating Systems', 'CS204', 3, 45, 0, 2],
            ['Web Development', 'IT221', 3, 50, 1, 0],
            ['Computer Networks', 'IT242', 3, 45, 1, 3],
            ['Marketing Principles', 'BA110', 2, 80, 2, 1],
            ['Accounting Fundamentals', 'BA120', 3, 80, 2, 2],
            ['Software Project Management', 'SE301', 3, 40, 3, 0],
        ];

        $courses = [];

        foreach ($specs as [$name, $code, $hours, $capacity, $deptIndex, $profIndex]) {
            $courses[] = Course::updateOrCreate(['course_code' => $code], [
                'course_name' => $name,
                'no_of_hours' => $hours,
                'capacity' => $capacity,
                'department_id' => $this->departments[$deptIndex]->id,
                'professor_id' => $this->professorUsers[$profIndex]->id,
                'admin_id' => $this->super->id,
                'semester_id' => $this->semester->id,
            ]);
        }

        return $courses;
    }

    private function seedPrerequisites(): void
    {
        $links = [
            ['CS204', 'CS201'],
            ['CS203', 'CS201'],
            ['SE301', 'CS201'],
            ['BA120', 'BA110'],
        ];

        $byCode = collect($this->courses)->keyBy('course_code');

        foreach ($links as [$course, $prerequisite]) {
            if (! isset($byCode[$course], $byCode[$prerequisite])) {
                continue;
            }

            DB::table('course_prerequisites')->updateOrInsert(
                ['course_id' => $byCode[$course]->id, 'prerequisite_course_id' => $byCode[$prerequisite]->id],
                ['created_at' => now(), 'updated_at' => now()]
            );
        }
    }

    private function seedSchedules(): void
    {
        $days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
        $courseLevels = [0, 1, 2, 0, 1, 1, 2, 0];
        $times = [['09:00', '10:30'], ['11:00', '12:30']];

        foreach ($this->courses as $index => $course) {
            foreach ($times as $slot => [$start, $end]) {
                Schedule::updateOrCreate([
                    'semester_id' => $this->semester->id,
                    'course_id' => $course->id,
                    'day_of_week' => $days[($index + $slot) % count($days)],
                    'start_time' => $start,
                    'end_time' => $end,
                    'section_type' => $slot === 0 ? 'lecture' : 'section',
                ], [
                    'level_id' => $this->levels[$courseLevels[$index]]->id,
                    'department_id' => $course->department_id,
                    'room_id' => $this->rooms[($index + $slot) % count($this->rooms)]->id,
                    'admin_id' => $this->super->id,
                    'path' => null,
                ]);
            }
        }
    }

    private function seedStudentCourses(): void
    {
        foreach ($this->studentUsers as $index => $student) {
            $picks = [
                $this->courses[$index % count($this->courses)],
                $this->courses[($index + 2) % count($this->courses)],
                $this->courses[($index + 5) % count($this->courses)],
            ];

            foreach ($picks as $pickIndex => $course) {
                $status = StudentCourse::STATUS_REGISTERED;

                if ($index === 0 && $pickIndex === 0) {
                    $status = StudentCourse::STATUS_COMPLETED;
                } elseif ($index === 1 && $pickIndex === 1) {
                    $status = StudentCourse::STATUS_FAILED;
                } elseif ($index === 2 && $pickIndex === 2) {
                    $status = StudentCourse::STATUS_DROPPED;
                }

                StudentCourse::updateOrCreate(
                    ['student_id' => $student->id, 'course_id' => $course->id],
                    [
                        'progress' => $status === StudentCourse::STATUS_COMPLETED ? 100 : rand(10, 90),
                        'status' => $status,
                        'status_changed_at' => now()->subDays(rand(1, 30)),
                        'semester_id' => $this->semester->id,
                    ]
                );
            }
        }
    }

    private function seedLecturesAndProgress(): void
    {
        foreach ($this->courses as $course) {
            for ($n = 1; $n <= 3; $n++) {
                Lecture::updateOrCreate(
                    ['course_id' => $course->id, 'name' => "Lecture {$n}"],
                    ['content' => "lectures/{$course->course_code}-lec{$n}.pdf"]
                );
            }
        }

        foreach (array_slice($this->studentUsers, 0, 4) as $student) {
            $enrollments = StudentCourse::where('student_id', $student->id)->take(2)->get();

            foreach ($enrollments as $enrollment) {
                $lecture = Lecture::where('course_id', $enrollment->course_id)->orderBy('id')->first();

                if (! $lecture) {
                    continue;
                }

                StudentLecture::updateOrCreate(
                    ['student_id' => $student->id, 'lecture_id' => $lecture->id],
                    ['course_id' => $enrollment->course_id, 'watched_at' => now()->subDays(rand(1, 6))]
                );
            }
        }
    }

    private function seedGrades(): void
    {
        $componentSpecs = [
            ['Midterm Exam', 30, 0],
            ['Final Exam', 50, 1],
            ['Quizzes', 20, 2],
        ];

        /** @var array<int, array<int, GradeComponent>> $componentsByCourse */
        $componentsByCourse = [];

        foreach (array_slice($this->courses, 0, 3) as $course) {
            foreach ($componentSpecs as [$name, $weight, $position]) {
                $componentsByCourse[$course->id][] = GradeComponent::updateOrCreate(
                    ['course_id' => $course->id, 'name' => $name],
                    ['weight' => $weight, 'position' => $position]
                );
            }
        }

        $enrollments = StudentCourse::where('semester_id', $this->semester->id)
            ->whereIn('status', [StudentCourse::STATUS_REGISTERED, StudentCourse::STATUS_COMPLETED, StudentCourse::STATUS_FAILED])
            ->get();

        foreach ($enrollments as $index => $enrollment) {
            $status = Grade::STATUS_PUBLISHED;

            if ($index % 9 === 4) {
                $status = Grade::STATUS_DRAFT;
            } elseif ($index % 9 === 7) {
                $status = Grade::STATUS_LOCKED;
            }

            $marks = rand(45, 98);

            $grade = Grade::updateOrCreate(
                [
                    'student_id' => $enrollment->student_id,
                    'course_id' => $enrollment->course_id,
                    'semester_id' => $this->semester->id,
                ],
                [
                    'marks' => $marks,
                    'max_marks' => 100,
                    'status' => $status,
                    'published_at' => $status === Grade::STATUS_DRAFT ? null : now()->subDays(rand(1, 20)),
                    'published_by_type' => $status === Grade::STATUS_DRAFT ? null : Admin::class,
                    'published_by_id' => $status === Grade::STATUS_DRAFT ? null : $this->super->id,
                    'locked_at' => $status === Grade::STATUS_LOCKED ? now()->subDays(5) : null,
                    'locked_by_type' => $status === Grade::STATUS_LOCKED ? Admin::class : null,
                    'locked_by_id' => $status === Grade::STATUS_LOCKED ? $this->super->id : null,
                ]
            );

            foreach ($componentsByCourse[$enrollment->course_id] ?? [] as $component) {
                GradeComponentScore::updateOrCreate(
                    ['grade_id' => $grade->id, 'grade_component_id' => $component->id],
                    [
                        'marks' => round($component->weight / 100 * $marks, 2),
                        'max_marks' => $component->weight,
                    ]
                );
            }
        }

        $published = Grade::where('status', Grade::STATUS_PUBLISHED)->orderBy('id')->first();

        if ($published) {
            GradeAppeal::updateOrCreate(
                ['grade_id' => $published->id, 'student_id' => $published->student_id],
                [
                    'reason' => 'The final exam score looks lower than expected; please review question 3.',
                    'status' => 'pending',
                ]
            );
        }
    }

    private function seedQuizzes(): void
    {
        foreach ($this->courses as $index => $course) {
            $quiz = Quiz::updateOrCreate(
                ['course_id' => $course->id, 'name' => 'Quiz 1 - ' . $course->course_code],
                [
                    'content' => "quizzes/{$course->course_code}-quiz1.pdf",
                    'max_score' => 20,
                    'due_at' => now()->addDays(7),
                    'published_at' => now()->subDay(),
                ]
            );

            if ($index >= 2) {
                continue;
            }

            $students = StudentCourse::where('course_id', $course->id)
                ->where('status', StudentCourse::STATUS_REGISTERED)
                ->pluck('student_id')
                ->take(4);

            foreach ($students as $position => $studentId) {
                $graded = $position < 3;

                QuizSubmission::updateOrCreate(
                    ['quiz_id' => $quiz->id, 'student_id' => $studentId],
                    [
                        'answer_text' => 'Submission for ' . $course->course_code . ' quiz 1.',
                        'submitted_at' => now()->subHours(rand(2, 40)),
                        'score' => $graded ? rand(12, 20) : null,
                        'feedback' => $graded ? 'Good work; review the last section.' : null,
                        'graded_by_type' => $graded ? User::class : null,
                        'graded_by_id' => $graded ? $course->professor_id : null,
                        'graded_at' => $graded ? now()->subHours(rand(1, 10)) : null,
                    ]
                );
            }
        }
    }

    private function seedAnnouncements(): void
    {
        $templates = [
            ['Welcome to the course', 'Please review the syllabus and the lecture schedule for this course.'],
            ['Assignment deadline reminder', 'Remember that the first assignment is due at the end of next week.'],
        ];

        foreach ($this->courses as $course) {
            foreach ($templates as [$title, $body]) {
                Announcement::updateOrCreate(
                    ['course_id' => $course->id, 'title' => $title],
                    ['professor_id' => $course->professor_id, 'body' => $body]
                );
            }
        }

        Announcement::updateOrCreate(
            ['course_id' => $this->courses[0]->id, 'title' => 'إعلان باللغة العربية'],
            [
                'professor_id' => $this->courses[0]->professor_id,
                'body' => 'يرجى الاطلاع على جدول المحاضرات الجديد قبل بداية الأسبوع القادم.',
            ]
        );
    }

    private function seedAttendance(): void
    {
        foreach (array_slice($this->courses, 0, 3) as $course) {
            $lecture = Lecture::where('course_id', $course->id)->orderBy('id')->first();

            if (! $lecture) {
                continue;
            }

            $students = StudentCourse::where('course_id', $course->id)
                ->where('status', StudentCourse::STATUS_REGISTERED)
                ->pluck('student_id');

            for ($week = 0; $week < 4; $week++) {
                $date = now()->subWeeks($week)->toDateString();

                foreach ($students as $position => $studentId) {
                    $present = ! (($position + $week) % 5 === 0);

                    Attendance::updateOrCreate(
                        ['student_id' => $studentId, 'course_id' => $course->id, 'lec_id' => $lecture->id, 'date' => $date],
                        [
                            'status' => $present,
                            'reason' => $present ? null : 'Absent without notice',
                            'professor_id' => $course->professor_id,
                            'recorded_by_type' => User::class,
                            'recorded_by_id' => $course->professor_id,
                        ]
                    );
                }
            }
        }

        $firstCourse = $this->courses[0];
        $flagged = StudentCourse::where('course_id', $firstCourse->id)
            ->where('status', StudentCourse::STATUS_REGISTERED)
            ->value('student_id');

        if ($flagged) {
            AttendanceThresholdAlert::updateOrCreate(
                ['student_id' => $flagged, 'course_id' => $firstCourse->id, 'threshold' => 'warning'],
                ['notified_at' => now()->subDay()]
            );
        }
    }

    private function seedPayments(): void
    {
        foreach ($this->studentUsers as $index => $student) {
            $type = $index % 5 === 4 ? Payment::TYPE_YEAR : Payment::TYPE_COURSES;

            $status = match (true) {
                $index === 6 => Payment::STATUS_PENDING,
                $index === 7 => Payment::STATUS_WAIVED,
                $index === 8 => Payment::STATUS_REFUNDED,
                $index === 9 => Payment::STATUS_FAILED,
                default => Payment::STATUS_PAID,
            };

            Payment::updateOrCreate(
                ['user_id' => $student->id, 'semester_id' => $this->semester->id, 'type' => $type],
                [
                    'amount' => Payment::priceFor($type),
                    'status' => $status,
                    'admin_id' => $status === Payment::STATUS_PENDING ? null : $this->super->id,
                    'note' => in_array($status, [Payment::STATUS_WAIVED, Payment::STATUS_REFUNDED], true) ? 'Set by finance (demo).' : null,
                    'paid_at' => $status === Payment::STATUS_PAID ? now()->subDays(rand(1, 20)) : null,
                    'waived_at' => $status === Payment::STATUS_WAIVED ? now()->subDays(3) : null,
                    'refunded_at' => $status === Payment::STATUS_REFUNDED ? now()->subDays(2) : null,
                    'receipt_number' => in_array($status, [Payment::STATUS_PAID, Payment::STATUS_WAIVED], true)
                        ? 'RCPT-2026-' . str_pad((string) ($index + 1), 6, '0', STR_PAD_LEFT)
                        : null,
                ]
            );
        }
    }

    private function seedEventsAndNotifications(): void
    {
        $events = [
            ['Opening Ceremony 2026', 'Welcome all students and faculty to the new academic year.', Event::AUDIENCE_ALL],
            ['IT Career Day', 'A full day of talks and networking with leading technology companies.', Event::AUDIENCE_ALL],
            ['CS & SE Hackathon', '48 hours of building and coding for Computer Science and Software Engineering students.', Event::AUDIENCE_TARGETED],
            ['Level 4 Graduation Briefing', 'Final briefing for graduating students.', Event::AUDIENCE_TARGETED],
        ];

        foreach ($events as $index => [$title, $content, $audience]) {
            $event = Event::updateOrCreate(['title' => $title], [
                'content' => $content,
                'admin_id' => $this->super->id,
                'image' => 'img.png',
                'audience' => $audience,
            ]);

            if ($audience === Event::AUDIENCE_TARGETED && $index === 2) {
                $event->departments()->sync([$this->departments[0]->id, $this->departments[3]->id]);
                $event->levels()->sync([]);
            } elseif ($audience === Event::AUDIENCE_TARGETED) {
                $event->departments()->sync([]);
                $event->levels()->sync([$this->levels[3]->id]);
            }

            Notification::updateOrCreate(['title' => $title, 'type' => Notification::TYPE_EVENT], [
                'content' => $content,
                'admin_id' => $this->super->id,
                'image_path' => 'img.png',
            ]);
        }

        Notification::updateOrCreate(['title' => 'Welcome to UniversTech', 'type' => Notification::TYPE_NOTIFICATION], [
            'content' => 'Your account is ready. Check your schedule and courses for the new semester.',
            'admin_id' => $this->super->id,
        ]);

        foreach ($this->studentUsers as $student) {
            Notification::updateOrCreate(
                ['title' => 'Enrollment confirmed', 'type' => Notification::TYPE_NOTIFICATION, 'student_id' => $student->id],
                ['content' => 'You have been enrolled in your courses for the first semester.', 'admin_id' => $this->super->id]
            );
        }
    }

    private function seedAccessRequests(): void
    {
        $requests = [
            ['New Applicant', 'applicant1@example.com', AccessRequest::STATUS_PENDING, null, 0, 0],
            ['Second Applicant', 'applicant2@example.com', AccessRequest::STATUS_PENDING, null, 1, 1],
            ['Accepted Applicant', 'accepted@example.com', AccessRequest::STATUS_ACCEPTED, null, 2, 2],
            ['Refused Applicant', 'refused@example.com', AccessRequest::STATUS_REFUSED, 'Submitted documents were incomplete.', 3, 0],
        ];

        foreach ($requests as $index => [$name, $email, $status, $reason, $deptIndex, $levelIndex]) {
            AccessRequest::updateOrCreate(['email' => $email], [
                'name' => $name,
                'password' => Hash::make(self::DEMO_PASSWORD),
                'phone' => '015' . str_pad((string) ($index + 1), 8, '0', STR_PAD_LEFT),
                'national_id' => '301' . str_pad((string) ($index + 1), 11, '0', STR_PAD_LEFT),
                'gender' => true,
                'level_id' => $this->levels[$levelIndex]->id,
                'department_id' => $this->departments[$deptIndex]->id,
                'status' => $status,
                'admin_id' => $status === AccessRequest::STATUS_PENDING ? null : $this->super->id,
                'decided_at' => $status === AccessRequest::STATUS_PENDING ? null : now()->subDays(3),
                'rejection_reason' => $reason,
            ]);
        }
    }

    private function seedPromotions(): void
    {
        $student = $this->studentUsers[0];

        StudentPromotion::updateOrCreate(
            ['student_id' => $student->id, 'from_semester_id' => $this->pastSemester->id],
            [
                'to_semester_id' => $this->semester->id,
                'action' => StudentPromotion::ACTION_PROMOTED,
                'from_level_id' => $this->levels[0]->id,
                'to_level_id' => $this->levels[1]->id,
                'applied_at' => now()->subMonths(2),
            ]
        );
    }

    private function listDemoAccounts(): void
    {
        if (! $this->command) {
            return;
        }

        $this->command->info('Demo accounts (password: ' . self::DEMO_PASSWORD . '):');

        foreach (self::DEMO_ACCOUNTS as [$name, $email, $role]) {
            $this->command->line(sprintf('  - %-30s %-26s %s', $email, $name, $role));
        }
    }
}
