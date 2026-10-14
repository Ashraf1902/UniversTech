<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminAddCourseRequest;
use App\Http\Requests\Admin\AdminUpdateCourseRequest;
use App\Models\Course;
use App\Models\User;
use App\Traits\File\DeleteFile;
use App\Traits\File\UpdateFile;
use App\Traits\File\UploadFile;
use App\Traits\Notifiable;
use Illuminate\Http\Request;

class CourseAdminController extends Controller
{
    use UploadFile, DeleteFile, UpdateFile, Notifiable;

    public function index(Request $request)
    {
        $courses = ($request->boolean('deleted') ? Course::onlyTrashed() : Course::query())
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = $request->search;
                $q->where(fn ($qq) => $qq->where('course_name', 'like', "%{$term}%")->orWhere('course_code', 'like', "%{$term}%"));
            })
            ->orderByDesc('created_at')
            ->with(['admin', 'department', 'professor', 'lectures', 'semester', 'prerequisites'])
            ->paginate(15)
            ->through(fn (Course $course) => [
                'id' => $course->id,
                'course_name' => $course->course_name,
                'no_of_hours' => $course->no_of_hours,
                'capacity' => $course->capacity,
                'course_code' => $course->course_code,
                'cover_image' => url('uploads/' . $course->cover_image),
                'department' => $course->department?->name,
                'professor' => $course->professor?->name,
                'semester' => $course->semester?->name,
                'lecture_count' => $course->lectures->count(),
                'prerequisite_ids' => $course->prerequisites->pluck('id')->all(),
                'created_by' => $course->admin?->name,
                'updated_at' => $course->updated_at,
                'created_at' => $course->created_at,
                'deleted_at' => $course->deleted_at,
            ]);

        return SendResponse(200, 'Courses fetched successfully.', $courses);
    }

    public function store(AdminAddCourseRequest $request)
    {
        $professor = User::find($request->professor_id);

        if (! $professor || ! $professor->isProfessor()) {
            return SendResponse(422, 'Selected account is not a professor.');
        }

        $cover = 'default.jpg';

        if ($request->hasFile('cover_image')) {
            $cover = $this->uploadFile($request, 'cover_image', 'images/courses/covers');
        }

        $course = Course::create([
            'course_name' => $request->course_name,
            'no_of_hours' => $request->no_of_hours,
            'course_code' => $request->course_code,
            'cover_image' => $cover,
            'department_id' => $request->department_id,
            'professor_id' => $request->professor_id,
            'admin_id' => $request->user()->id,
            'semester_id' => $request->semester_id,
            'capacity' => $request->input('capacity'),
        ]);

        $course->prerequisites()->sync($this->prerequisiteIds($request, $course->id));

        $this->notifyAdmin(
            'Course created',
            'New course "' . $course->course_name . '" has been created.'
        );

        return SendResponse(201, 'Course created successfully.');
    }

    public function delete(Request $request, $courseId)
    {
        $course = Course::find($courseId);

        if (! $course) {
            return SendResponse(404, 'Course not found.');
        }

        $course->delete();

        return SendResponse(200, 'Course archived, can be restored later.');
    }

    public function restore(Request $request, $courseId)
    {
        $course = Course::onlyTrashed()->find($courseId);

        if (! $course) {
            return SendResponse(404, 'Archived course not found.');
        }

        $course->restore();

        return SendResponse(200, 'Course restored successfully.');
    }

    public function purge(Request $request, $courseId)
    {
        if (! $request->user()->isSuperAdmin()) {
            return SendResponse(403, 'Only a super admin can permanently delete courses.');
        }

        $course = Course::withTrashed()->find($courseId);

        if (! $course) {
            return SendResponse(404, 'Course not found.');
        }

        $course->forceDelete();

        return SendResponse(200, 'Course permanently deleted.');
    }

    public function getCourseById(Request $request, $id)
    {
        $course = Course::with(['admin', 'department', 'professor', 'semester', 'prerequisites'])->find($id);

        if (! $course) {
            return SendResponse(404, 'Course not found.');
        }

        $course->setAttribute('prerequisite_course_ids', $course->prerequisites->pluck('id')->all());

        return SendResponse(200, 'Course fetched successfully.', $course);
    }

    public function update(AdminUpdateCourseRequest $request)
    {
        $course = Course::find($request->course_id);

        if (! $course) {
            return SendResponse(404, 'Course not found.');
        }

        if ($request->filled('professor_id')) {
            $professor = User::find($request->professor_id);

            if (! $professor || ! $professor->isProfessor()) {
                return SendResponse(422, 'Selected account is not a professor.');
            }
        }

        $cover = $course->cover_image;

        if ($request->hasFile('cover_image')) {
            if ($cover === 'default.jpg') {
                $cover = $this->uploadFile($request, 'cover_image', 'images/courses/covers');
            } else {
                $cover = $this->updateFile($cover, $request, 'cover_image', 'images/courses/covers');
            }
        }

        $course->update([
            'course_name' => $request->input('course_name', $course->course_name),
            'no_of_hours' => $request->input('no_of_hours', $course->no_of_hours),
            'course_code' => $request->input('course_code', $course->course_code),
            'department_id' => $request->input('department_id', $course->department_id),
            'professor_id' => $request->input('professor_id', $course->professor_id),
            'semester_id' => $request->input('semester_id', $course->semester_id),
            'cover_image' => $cover,
            'capacity' => $request->has('capacity') ? $request->input('capacity') : $course->capacity,
        ]);

        if ($request->has('prerequisite_course_ids')) {
            $course->prerequisites()->sync($this->prerequisiteIds($request, $course->id));
        }

        return SendResponse(200, 'Course updated successfully.');
    }

    /**
     * Prerequisite course ids, excluding the course itself.
     *
     * @return array<int, int>
     */
    private function prerequisiteIds(Request $request, int $courseId): array
    {
        $ids = $request->input('prerequisite_course_ids', []);

        if (! is_array($ids)) {
            return [];
        }

        return array_values(array_unique(array_filter(
            array_map('intval', $ids),
            fn (int $id) => $id !== $courseId
        )));
    }
}
