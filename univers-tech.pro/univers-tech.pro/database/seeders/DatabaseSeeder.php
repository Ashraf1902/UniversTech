<?php

namespace Database\Seeders;

use App\Models\Admin;
use App\Models\Course;
use App\Models\Department;
use App\Models\Event;
use App\Models\Grade;
use App\Models\Lecture;
use App\Models\Level;
use App\Models\Notification;
use App\Models\Professor;
use App\Models\Schedule;
use App\Models\Semester;
use App\Models\Student;
use App\Models\StudentCourse;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run()
    {
        $super = Admin::updateOrCreate(['email' => 'ashraf@gmail.com'], [
            'name' => 'Ashraf Mahmoud',
            'password' => Hash::make('password'),
            'is_super_admin' => true,
            'roles' => null,
        ]);

        Admin::updateOrCreate(['email' => 'accounts@universtech.edu'], [
            'name' => 'Accounts Admin',
            'password' => Hash::make('password'),
            'is_super_admin' => false,
            'roles' => ['accounts'],
        ]);
        Admin::updateOrCreate(['email' => 'courses@universtech.edu'], [
            'name' => 'Courses Admin',
            'password' => Hash::make('password'),
            'is_super_admin' => false,
            'roles' => ['courses', 'schedules', 'grades'],
        ]);
        Admin::updateOrCreate(['email' => 'events@universtech.edu'], [
            'name' => 'Events Admin',
            'password' => Hash::make('password'),
            'is_super_admin' => false,
            'roles' => ['events'],
        ]);

        $levels = [];
        foreach (['Level 1', 'Level 2', 'Level 3', 'Level 4'] as $name) {
            $levels[] = Level::updateOrCreate(['name' => $name]);
        }

        $departments = [];
        foreach ([['Computer Science', 'CS'], ['Information Technology', 'IT'], ['Business Administration', 'BA'], ['Software Engineering', 'SE']] as [$name, $abbr]) {
            $departments[] = Department::updateOrCreate(['name' => $name], [
                'abbrevation' => $abbr,
                'admin_id' => $super->id,
            ]);
        }

        $sem1 = Semester::updateOrCreate(['name' => 'First Semester 2026'], [
            'academic_year' => '2026-2027',
            'is_active' => true,
        ]);
        $sem2 = Semester::updateOrCreate(['name' => 'Second Semester 2026'], [
            'academic_year' => '2026-2027',
            'is_active' => false,
        ]);

        $makeUser = function (string $email, string $name, int $type, int $deptIdx, int $levelIdx, string $semester) use ($super, $departments, $levels) {
            return User::updateOrCreate(['email' => $email], [
                'name' => $name,
                'password' => Hash::make('password'),
                'gender' => 0,
                'nationalid' => rand(302000000000, 302999999999),
                'phone' => '010' . str_pad((string) rand(0, 99999999), 8, '0', STR_PAD_LEFT),
                'credit_points' => rand(12, 38),
                'semester' => $semester,
                'type' => $type,
                'admin_id' => $super->id,
                'department_id' => $departments[$deptIdx]->id,
                'level_id' => $levels[$levelIdx]->id,
            ]);
        };

        $professors = [];
        foreach ([['prof@test.com', 'Prof. Ahmed Hassan', 0, 0], ['prof2@universtech.edu', 'Dr. Mona Ali', 1, 1], ['prof3@universtech.edu', 'Dr. Omar Khaled', 2, 2], ['prof4@universtech.edu', 'Dr. Sara Mostafa', 0, 3]] as [$email, $name, $deptIdx, $levelIdx]) {
            $user = $makeUser($email, $name, User::TYPE_PROFESSOR, $deptIdx, $levelIdx, 'first');
            $professors[] = Professor::updateOrCreate(['user_id' => $user->id], [
                'department_id' => $user->department_id,
                'job_title' => $name,
            ]);
        }

        $students = [];
        $studentSpecs = [
            ['student@test.com', 'Student Demo', 0, 0, 'first'],
            ['student2@universtech.edu', 'Laila Hassan', 1, 1, 'first'],
            ['student3@universtech.edu', 'Mohamed Salah', 2, 2, 'first'],
            ['student4@universtech.edu', 'Nour El-Din', 0, 3, 'second'],
            ['student5@universtech.edu', 'Youssef Adel', 1, 0, 'second'],
            ['student6@universtech.edu', 'Farah Ibrahim', 2, 1, 'second'],
            ['student7@universtech.edu', 'Omar Tarek', 3, 2, 'second'],
            ['student8@universtech.edu', 'Hana Mahmoud', 0, 3, 'first'],
            ['student9@universtech.edu', 'Ziad Sherif', 1, 0, 'first'],
            ['student10@universtech.edu', 'Mariam Khaled', 2, 1, 'first'],
        ];
        foreach ($studentSpecs as [$email, $name, $deptIdx, $levelIdx, $semester]) {
            $user = $makeUser($email, $name, User::TYPE_STUDENT, $deptIdx, $levelIdx, $semester);
            $students[] = Student::updateOrCreate(['user_id' => $user->id], [
                'department_id' => $user->department_id,
                'level_id' => $user->level_id,
                'semester' => $user->semester,
                'credit_points' => $user->credit_points,
            ]);
        }

        $coursesData = [
            ['Database Systems', 'CS203', 3, 0, 0],
            ['Data Structures', 'CS201', 3, 0, 1],
            ['Operating Systems', 'CS204', 3, 0, 2],
            ['Web Development', 'IT221', 3, 1, 0],
            ['Computer Networks', 'IT242', 3, 1, 3],
            ['Marketing Principles', 'BA110', 2, 2, 1],
            ['Accounting Fundamentals', 'BA120', 3, 2, 2],
            ['Software Project Management', 'SE301', 3, 3, 0],
        ];
        $courses = [];
        foreach ($coursesData as [$name, $code, $hours, $deptIdx, $profIdx]) {
            $courses[] = Course::updateOrCreate(['course_code' => $code], [
                'course_name' => $name,
                'no_of_hours' => $hours,
                'department_id' => $departments[$deptIdx]->id,
                'professor_id' => $professors[$profIdx]->user_id,
                'admin_id' => $super->id,
                'semester_id' => $sem1->id,
            ]);
        }

        foreach ($students as $i => $student) {
            $picked = [$courses[$i % count($courses)], $courses[($i + 2) % count($courses)], $courses[($i + 5) % count($courses)]];
            foreach ($picked as $course) {
                StudentCourse::updateOrCreate(
                    ['student_id' => $student->user_id, 'course_id' => $course->id],
                    ['progress' => rand(10, 100)]
                );
            }
        }

        foreach ($courses as $course) {
            for ($n = 1; $n <= 3; $n++) {
                Lecture::updateOrCreate(
                    ['course_id' => $course->id, 'name' => "Lecture {$n}"],
                    ['content' => "lectures/{$course->course_code}-lec{$n}.pdf"]
                );
            }
        }

        $studentCourses = StudentCourse::all();
        foreach ($studentCourses as $sc) {
            Grade::updateOrCreate(
                ['student_id' => $sc->student_id, 'course_id' => $sc->course_id, 'semester_id' => $sem1->id],
                ['marks' => rand(55, 98), 'max_marks' => 100]
            );
            Grade::updateOrCreate(
                ['student_id' => $sc->student_id, 'course_id' => $sc->course_id, 'semester_id' => $sem2->id],
                ['marks' => rand(50, 95), 'max_marks' => 100]
            );
        }

        $courseLevels = [0, 1, 2, 3, 0, 1, 2, 3];
        $days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
        foreach ($courses as $i => $course) {
            $slots = [
                [$days[$i % count($days)], '09:00', '10:30', 'lecture'],
                [$days[($i + 1) % count($days)], '11:00', '12:30', 'section'],
            ];
            foreach ($slots as [$day, $start, $end, $section]) {
                Schedule::updateOrCreate(
                    ['level_id' => $levels[$courseLevels[$i]]->id, 'semester_id' => $sem1->id, 'department_id' => $course->department_id, 'day_of_week' => $day, 'start_time' => $start, 'end_time' => $end, 'section_type' => $section],
                    ['course_id' => $course->id, 'admin_id' => $super->id, 'path' => null]
                );
            }
        }

        $events = [
            ['Opening Ceremony 2026', 'Welcome all students and faculty to the new academic year opening ceremony.', 'img.png'],
            ['IT Career Day', 'A full day of talks and networking with leading technology companies.', 'img.png'],
            ['Hackathon Weekend', '48 hours of building, learning and coding with your teammates.', 'img.png'],
            ['Final Exam Timetable Announcement', 'Official announcement of the final exams schedule for this semester.', 'img.png'],
        ];
        foreach ($events as [$title, $content, $image]) {
            Event::updateOrCreate(['title' => $title], [
                'content' => $content,
                'admin_id' => $super->id,
                'image' => $image,
            ]);
            Notification::updateOrCreate(['title' => $title, 'type' => Notification::TYPE_EVENT], [
                'content' => $content,
                'admin_id' => $super->id,
                'image_path' => $image,
            ]);
        }

        Notification::updateOrCreate(['title' => 'Welcome to UniversTech', 'type' => Notification::TYPE_NOTIFICATION], [
            'content' => 'Your account is ready. Check your schedule and courses for the new semester.',
            'admin_id' => $super->id,
            'student_id' => null,
            'professor_id' => null,
        ]);
        foreach ($students as $student) {
            Notification::updateOrCreate(['title' => 'Enrollment confirmed', 'type' => Notification::TYPE_NOTIFICATION, 'student_id' => $student->user_id], [
                'content' => 'You have been enrolled in your courses for the first semester.',
                'admin_id' => $super->id,
                'student_id' => $student->user_id,
                'professor_id' => null,
            ]);
        }
    }
}