<?php

namespace App\Http\Controllers\Professor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Professor\ProfessorAddQuizRequest;
use App\Models\Course;
use App\Models\Quiz;
use App\Models\StudentCourse;
use App\Traits\AuthorizesCourseOwnership;
use App\Traits\File\UploadFile;
use App\Traits\Notifiable;
use Illuminate\Http\Request;

class QuizProfessorController extends Controller
{
    use AuthorizesCourseOwnership, UploadFile, Notifiable;

    public function getQuizzesCourse(Request $request, $id)
    {
        $course = Course::find($id);

        if ($blocked = $this->authorizeCourseOwnership($request, $course, 'You are not allowed to view this course.')) {
            return $blocked;
        }

        $quizzes = Quiz::where('course_id', $id)
            ->orderByDesc('created_at')
            ->paginate(15)
            ->through(fn (Quiz $quiz) => [
                'id' => $quiz->id,
                'name' => $quiz->name,
                'content' => url('uploads/' . $quiz->content),
                'due_at' => $quiz->due_at,
                'created_at' => $quiz->created_at,
                'updated_at' => $quiz->updated_at,
            ]);

        return SendResponse(200, 'Quizzes fetched successfully.', $quizzes);
    }

    public function delete(Request $request, $id)
    {
        $quiz = Quiz::with('course')->find($id);

        if (! $quiz) {
            return SendResponse(404, 'Quiz not found.');
        }

        if ($blocked = $this->authorizeCourseOwnership($request, $quiz->course, 'You are not allowed to delete this quiz.')) {
            return $blocked;
        }

        \Illuminate\Support\Facades\Storage::disk('files')->delete($quiz->content);
        $quiz->delete();

        return SendResponse(200, 'Quiz deleted successfully.');
    }

    public function store(ProfessorAddQuizRequest $request)
    {
        $course = Course::find($request->course_id);

        if ($blocked = $this->authorizeCourseOwnership($request, $course, 'You are not allowed to add quizzes to this course.')) {
            return $blocked;
        }

        $path = $this->uploadFile($request, 'pdf', 'quizzes');

        $quiz = Quiz::create([
            'name' => $request->name,
            'content' => $path,
            'course_id' => $request->course_id,
            'due_at' => $request->due_at,
        ]);

        $studentIds = StudentCourse::where('course_id', $course->id)
            ->registered()
            ->pluck('student_id')
            ->toArray();

        if (! empty($studentIds)) {
            $this->notifyStudents(
                $studentIds,
                'New quiz available',
                'A new quiz "' . $quiz->name . '" has been added to "' . $course->course_name . '".',
                $request->user()->id
            );
        }

        $this->notifyAdmin(
            'New quiz uploaded',
            $request->user()->name . ' uploaded "' . $quiz->name . '" to "' . $course->course_name . '".'
        );

        return SendResponse(201, 'Quiz uploaded successfully.');
    }
}