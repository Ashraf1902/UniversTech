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
            'is_active' => ['sometimes', 'boolean'],
            'registration_opens_at' => ['nullable', 'date'],
            'registration_closes_at' => ['nullable', 'date', 'after_or_equal:registration_opens_at'],
        ]);

        // A new semester is created inactive unless explicitly activated, in
        // which case it goes through the same single-active invariant as
        // updates so it can never coexist with another active semester.
        $activate = (bool) ($data['is_active'] ?? false);

        $semester = Semester::create(collect($data)->except(['is_active'])->all());

        if ($activate) {
            $semester->activate();
        }

        $this->notifyAdmin(
            'Semester created',
            'Semester "' . $semester->name . ' (' . $semester->academic_year . ')" has been created.'
        );

        return SendResponse(201, 'Semester created successfully.', $semester->refresh());
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

        // Never allow two active semesters at once: activation deactivates
        // every other semester inside a single transaction (see
        // Semester::activate()). We activate first, then apply the remaining
        // fields, so a concurrent request cannot slip a second active row in.
        if (array_key_exists('is_active', $data) && $data['is_active']) {
            $semester->activate();
        }

        $semester->update(collect($data)->except(['is_active', 'semester_id'])->all());

        return SendResponse(200, 'Semester updated successfully.', $semester->refresh());
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