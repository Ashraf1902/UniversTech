<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Semester;
use App\Traits\Notifiable;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SemesterAdminController extends Controller
{
    use Notifiable;

    public function index(Request $request)
    {
        $semesters = Semester::withCount('courses')
            ->orderByDesc('created_at')
            ->paginate(15);

        return SendResponse(200, 'Semesters fetched successfully.', $semesters);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'academic_year' => ['required', 'string', 'max:20'],
        ]);

        $semester = Semester::create($data);

        $this->notifyAdmin(
            'Semester created',
            'Semester "' . $semester->name . ' (' . $semester->academic_year . ')" has been created.'
        );

        return SendResponse(201, 'Semester created successfully.', $semester);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'semester_id' => 'required|exists:semesters,id',
            'name' => 'sometimes|string|max:100',
            'academic_year' => 'sometimes|string|max:20',
            'is_active' => 'sometimes|boolean',
            'grading_system' => 'sometimes|in:gpa,fixed_term',
        ]);

        $semester = Semester::find($request->semester_id);

        $semester->update($data);

        return SendResponse(200, 'Semester updated successfully.', $semester);
    }

    public function delete(Request $request, $id)
    {
        $semester = Semester::find($id);

        if (! $semester) {
            return SendResponse(404, 'Semester not found.');
        }

        $semester->delete();

        return SendResponse(200, 'Semester deleted successfully.');
    }
}