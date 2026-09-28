<?php

use App\Http\Controllers\Admin\AccountAdminController;
use App\Http\Controllers\Admin\AccessRequestAdminController;
use App\Http\Controllers\Admin\AdminAuthController;
use App\Http\Controllers\Admin\AdminManagementController;
use App\Http\Controllers\Admin\CourseAdminController;
use App\Http\Controllers\Admin\DepartmentAdminController;
use App\Http\Controllers\Admin\EventAdminController;
use App\Http\Controllers\Admin\GradeAdminController;
use App\Http\Controllers\Admin\ScheduleAdminController;
use App\Http\Controllers\Admin\SemesterAdminController;
use App\Http\Controllers\API\AuthController as UserAuthController;
use App\Http\Controllers\API\AccessRequestController;
use App\Http\Controllers\API\PublicController;
use App\Http\Controllers\Professor\AttendaceProfessorController;
use App\Http\Controllers\Professor\AuthController as ProfessorAuthController;
use App\Http\Controllers\Professor\CourseProfessorController;
use App\Http\Controllers\Professor\EventProfessorController;
use App\Http\Controllers\Professor\GradeProfessorController;
use App\Http\Controllers\Professor\LectureProfessorController;
use App\Http\Controllers\Professor\ProfessorNotificationsController;
use App\Http\Controllers\Professor\QuizProfessorController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Health check
Route::get('/health', fn () => response()->json(['status' => 'ok']));

// Authentication
Route::prefix('auth')->group(function () {
    Route::post('login', [UserAuthController::class, 'login'])->middleware('throttle:5,1');
});

Route::prefix('prof/auth')->group(function () {
    Route::post('login', [ProfessorAuthController::class, 'login'])->middleware('throttle:5,1');
});

Route::prefix('admin/auth')->group(function () {
    Route::post('login', [AdminAuthController::class, 'login'])->middleware('throttle:5,1');
});

// Public routes
Route::prefix('public')->group(function () {
    Route::get('events', [PublicController::class, 'events']);
    Route::get('meta', [PublicController::class, 'meta']);
    Route::post('access-request', [AccessRequestController::class, 'store']);
});

// Admin routes
Route::middleware(['auth:sanctum', 'role:admin'])->prefix('admin')->group(function () {
    Route::post('auth/logout', [AdminAuthController::class, 'logout']);
    Route::get('profile', [AdminAuthController::class, 'me']);
});

Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
    // Admin management (super admin only — enforced in the controller)
    Route::post('admin-management/store', [AdminManagementController::class, 'store']);
    Route::get('admin-management/get/all', [AdminManagementController::class, 'index']);
    Route::post('admin-management/update', [AdminManagementController::class, 'update']);
    Route::delete('admin-management/delete/{id}', [AdminManagementController::class, 'delete']);

    // Events
    Route::middleware('admin-scope:events')->group(function () {
        Route::post('event/store', [EventAdminController::class, 'store']);
        Route::get('event/get/all', [EventAdminController::class, 'index']);
        Route::delete('event/delete/{id}', [EventAdminController::class, 'delete']);
        Route::get('event/single/{id}', [EventAdminController::class, 'getEventById']);
        Route::post('event/update', [EventAdminController::class, 'update']);
    });

    // Accounts
    Route::middleware('admin-scope:accounts')->group(function () {
        Route::post('user/store', [AccountAdminController::class, 'store']);
        Route::get('doctor/get/all', [AccountAdminController::class, 'getDoctors']);
        Route::get('student/get/all', [AccountAdminController::class, 'getStudents']);
        Route::get('user/single/{id}', [AccountAdminController::class, 'getUserById']);
        Route::put('user/update', [AccountAdminController::class, 'update']);
        Route::delete('user/delete/{id}', [AccountAdminController::class, 'delete']);
        Route::post('user/restore/{id}', [AccountAdminController::class, 'restore']);
        Route::delete('user/purge/{id}', [AccountAdminController::class, 'purge']);
    });

    // Departments
    Route::middleware('admin-scope:departments')->group(function () {
        Route::get('department/get/all', [DepartmentAdminController::class, 'index']);
        Route::get('department/single/{id}', [DepartmentAdminController::class, 'getDepartmentById']);
        Route::post('department/store', [DepartmentAdminController::class, 'store']);
        Route::delete('department/delete/{id}', [DepartmentAdminController::class, 'delete']);
        Route::put('department/update', [DepartmentAdminController::class, 'update']);
        Route::post('department/restore/{id}', [DepartmentAdminController::class, 'restore']);
        Route::delete('department/purge/{id}', [DepartmentAdminController::class, 'purge']);
    });

    // Courses
    Route::middleware('admin-scope:courses')->group(function () {
        Route::post('course/store', [CourseAdminController::class, 'store']);
        Route::get('course/get/all', [CourseAdminController::class, 'index']);
        Route::delete('course/delete/{id}', [CourseAdminController::class, 'delete']);
        Route::get('course/single/{id}', [CourseAdminController::class, 'getCourseById']);
        Route::post('course/update', [CourseAdminController::class, 'update']);
        Route::post('course/restore/{id}', [CourseAdminController::class, 'restore']);
        Route::delete('course/purge/{id}', [CourseAdminController::class, 'purge']);
    });

    // Semesters
    Route::middleware('admin-scope:semesters')->group(function () {
        Route::post('semester/store', [SemesterAdminController::class, 'store']);
        Route::get('semester/get/all', [SemesterAdminController::class, 'index']);
        Route::post('semester/update', [SemesterAdminController::class, 'update']);
        Route::delete('semester/delete/{id}', [SemesterAdminController::class, 'delete']);
    });

    // Schedules
    Route::middleware('admin-scope:schedules')->group(function () {
        Route::post('schedule/store', [ScheduleAdminController::class, 'store']);
        Route::get('schedule/get/all', [ScheduleAdminController::class, 'index']);
        Route::post('schedule/update', [ScheduleAdminController::class, 'update']);
        Route::delete('schedule/delete/{id}', [ScheduleAdminController::class, 'delete']);
    });

    // Grades & semester card
    Route::middleware('admin-scope:grades')->group(function () {
        Route::post('grade/store', [GradeAdminController::class, 'store']);
        Route::post('grade/update', [GradeAdminController::class, 'update']);
        Route::get('grade/get/all', [GradeAdminController::class, 'index']);
        Route::delete('grade/delete/{id}', [GradeAdminController::class, 'delete']);
        Route::post('grade/restore/{id}', [GradeAdminController::class, 'restore']);
        Route::delete('grade/purge/{id}', [GradeAdminController::class, 'purge']);
        Route::get('semester-card', [GradeAdminController::class, 'semesterCard']);
    });

    // Access requests
    Route::middleware('admin-scope:access_requests')->group(function () {
        Route::get('access-request/get/all', [AccessRequestAdminController::class, 'index']);
        Route::post('access-request/respond', [AccessRequestAdminController::class, 'respond']);
    });
});

// Professor routes
Route::middleware(['auth:sanctum', 'role:professor'])->group(function () {
    Route::get('professors/courses', [CourseProfessorController::class, 'getProfessorCourses']);
    Route::get('professors/course/student', [CourseProfessorController::class, 'getCoursesStudent']);
    Route::post('professors/make/attendance', [AttendaceProfessorController::class, 'storeAttendace']);
    Route::post('lecture/store', [LectureProfessorController::class, 'store']);
    Route::get('lecture/get/all/{id}', [LectureProfessorController::class, 'getLecturesCourse']);
    Route::post('quiz/store', [QuizProfessorController::class, 'store']);
    Route::get('quiz/get/all/{id}', [QuizProfessorController::class, 'getQuizzesCourse']);
    Route::delete('quiz/delete/{id}', [QuizProfessorController::class, 'delete']);
    Route::post('professor/grade/store', [GradeProfessorController::class, 'store']);
    Route::get('professor/grade/get/all', [GradeProfessorController::class, 'index']);
    Route::delete('professor/grade/delete/{id}', [GradeProfessorController::class, 'delete']);
    Route::post('professor/auth/logout', [ProfessorAuthController::class, 'logout']);
    Route::get('professor/profile', [ProfessorAuthController::class, 'me']);
    Route::get('professor/event/get/new', [EventProfessorController::class, 'latestEvents']);
    Route::get('professor/notifications', [ProfessorNotificationsController::class, 'notifications']);
});