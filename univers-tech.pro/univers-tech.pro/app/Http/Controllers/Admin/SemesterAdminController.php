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
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = $request->search;
                $q->where(fn ($qq) => $qq->where('name', 'like', "%{$term}%")->orWhere('academic_year', 'like', "%{$term}%"));
            })
            ->orderByDesc('created_at')
            ->paginate(15);

        return SendResponse(200, 'Semesters fetched successfully.', $semesters);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'academic_year' => ['required', 'string', 'max:20'],
            'registration_opens_at' => ['nullable', 'date'],
            'registration_closes_at' => ['nullable', 'date', 'after_or_equal:registration_opens_at'],
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
            'registration_opens_at' => 'nullable|date',
            'registration_closes_at' => 'nullable|date|after_or_equal:registration_opens_at',
        ]);

        $semester = Semester::find($request->semester_id);

        // Enforce single active semester: when activating, deactivate others.
        if (array_key_exists('is_active', $data) && $data['is_active']) {
            Semester::where('id', '!=', $semester->id)->update(['is_active' => false]);
        }

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