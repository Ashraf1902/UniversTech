<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminAddDepartmentRequest;
use App\Http\Requests\Admin\AdminUpdateDepartmentRequest;
use App\Models\Department;
use App\Traits\Notifiable;
use Illuminate\Http\Request;

class DepartmentAdminController extends Controller
{
    use Notifiable;

    public function index(Request $request)
    {
        $departments = Department::orderByDesc('created_at')
            ->with('admin')
            ->paginate(15)
            ->through(fn (Department $department) => [
                'id' => $department->id,
                'name' => $department->name,
                'abbreviation' => $department->abbrevation,
                'created_by' => $department->admin?->name,
                'created_at' => $department->created_at,
                'updated_at' => $department->updated_at,
            ]);

        return SendResponse(200, 'Departments fetched successfully.', $departments);
    }

    public function store(AdminAddDepartmentRequest $request)
    {
        Department::create([
            'name' => $request->name,
            'abbrevation' => $request->abbrevation,
            'admin_id' => $request->user()->id,
        ]);

        $this->notifyAdmin(
            'Department created',
            'Department "' . $request->name . '" has been created.'
        );

        return SendResponse(201, 'Department created successfully.');
    }

    public function getDepartmentById(Request $request, $id)
    {
        $department = Department::with('admin')->find($id);

        if (! $department) {
            return SendResponse(404, 'Department not found.');
        }

        return SendResponse(200, 'Department fetched successfully.', $department);
    }

    public function delete(Request $request, $id)
    {
        $department = Department::find($id);

        if (! $department) {
            return SendResponse(404, 'Department not found.');
        }

        $hasUsers = $department->users()->exists();
        $hasCourses = $department->courses()->exists();

        if ($hasUsers || $hasCourses) {
            return SendResponse(409, 'Cannot delete department with associated users or courses. Reassign them first.');
        }

        $department->delete();

        return SendResponse(200, 'Department deleted successfully.');
    }

    public function update(AdminUpdateDepartmentRequest $request)
    {
        $department = Department::find($request->department_id);

        if (! $department) {
            return SendResponse(404, 'Department not found.');
        }

        $department->update([
            'name' => $request->input('name', $department->name),
            'abbrevation' => $request->input('abbrevation', $department->abbrevation),
        ]);

        return SendResponse(200, 'Department updated successfully.');
    }
}
