<?php

namespace App\Http\Controllers\Professor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Professor\ProfessorAddLectureRequest;
use App\Models\Course;
use App\Models\Lecture;
use App\Models\StudentCourse;
use App\Traits\File\UploadFile;
use App\Traits\Notifiable;
use Illuminate\Http\Request;

class LectureProfessorController extends Controller
{
    use UploadFile, Notifiable;

    public function getLecturesCourse(Request $request, $id)
    {
        $course = Course::find($id);

        if (! $course || $course->professor_id !== $request->user()->id) {
            return SendResponse(403, 'You are not allowed to view this course.');
        }

        $lectures = Lecture::where('course_id', $id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Lecture $lecture) => [
                'id' => $lecture->id,
                'name' => $lecture->name,
                'path' => url('uploads/' . $lecture->content),
                'created_at' => $lecture->created_at,
                'updated_at' => $lecture->updated_at,
            ]);

        return SendResponse(200, 'Lectures fetched successfully.', $lectures);
    }

    public function store(ProfessorAddLectureRequest $request)
    {
        $course = Course::find($request->course_id);

        if (! $course || $course->professor_id !== $request->user()->id) {
            return SendResponse(403, 'You are not allowed to add lectures to this course.');
        }

        $path = $this->uploadFile($request, 'pdf', 'lectures');

        $lecture = Lecture::create([
            'name' => $request->name,
            'content' => $path,
            'course_id' => $request->course_id,
        ]);

        $studentIds = StudentCourse::where('course_id', $course->id)
            ->pluck('student_id')
            ->toArray();

        if (! empty($studentIds)) {
            $this->notifyStudents(
                $studentIds,
                'New lecture available',
                'A new lecture "' . $lecture->name . '" has been added to "' . $course->course_name . '".',
                $request->user()->id
            );
        }

        $this->notifyAdmin(
            'New lecture uploaded',
            $request->user()->name . ' uploaded "' . $lecture->name . '" to "' . $course->course_name . '".'
        );

        return SendResponse(201, 'Lecture uploaded successfully.');
    }
}
