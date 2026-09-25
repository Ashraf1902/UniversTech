<?php

use App\Http\Controllers\API\FactsController;
use App\Http\Controllers\API\Student\CoursesController;
use App\Http\Controllers\API\Student\LogoutController;
use App\Http\Controllers\API\Student\NotificationsController;
use App\Http\Controllers\API\Student\PaymentController;
use App\Http\Controllers\API\Student\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Student (Mobile & Web) API Routes
|--------------------------------------------------------------------------
|
| These routes are registered under the /api/user prefix with the
| "api" + "auth:sanctum" middleware groups (see RouteServiceProvider).
| The "student" role middleware guarantees the authenticated account
| is a student and not a professor or admin.
|
*/

Route::middleware('role:student')->group(function () {

    // Profile & session
    Route::get('', UserController::class);
    Route::get('logout', LogoutController::class);
    Route::get('facts', FactsController::class);

    // Notifications
    Route::prefix('notifications')->group(function () {
        Route::get('', [NotificationsController::class, 'notifications']);
        Route::get('events', [NotificationsController::class, 'events']);
        Route::get('announcments', [NotificationsController::class, 'announcments']);
    });

    // Payments
    Route::post('make-payment', PaymentController::class);

    // Course catalog & registration
    Route::get('all-courses', [CoursesController::class, 'allCourses']);
    Route::post('register-course', [CoursesController::class, 'register']);

    // Schedule & reports
    Route::get('schedule', [CoursesController::class, 'schedule']);
    Route::get('reports', [CoursesController::class, 'reports']);

    // Registered-course content (requires a paid courses subscription)
    Route::middleware('paid-courses')->group(function () {
        Route::get('courses', [CoursesController::class, 'myCourses']);
        Route::get('course/{id}', [CoursesController::class, 'showCourse']);
        Route::get('lecture/{lecture_id}', [CoursesController::class, 'showLecture']);
        Route::put('update_progress', [CoursesController::class, 'updateProgress']);
    });
});