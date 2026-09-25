<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminStoreAccountRequest;
use App\Http\Requests\Admin\AdminUpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Traits\Notifiable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AccountAdminController extends Controller
{
    use Notifiable;

    public function getDoctors(Request $request)
    {
        $doctors = User::where('type', User::TYPE_PROFESSOR)
            ->orderByDesc('created_at')
            ->with('admin')
            ->paginate(15)
            ->through(fn (User $user) => $this->formatUser($user, true));

        return SendResponse(200, 'Professors fetched successfully.', $doctors);
    }

    public function getStudents(Request $request)
    {
        $students = User::where('type', User::TYPE_STUDENT)
            ->orderByDesc('created_at')
            ->with(['admin', 'department', 'level'])
            ->paginate(15)
            ->through(fn (User $user) => $this->formatUser($user, false));

        return SendResponse(200, 'Students fetched successfully.', $students);
    }

    public function store(AdminStoreAccountRequest $request)
    {
        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'gender' => $request->gender,
            'nationalid' => $request->nationalid,
            'phone' => $request->phone,
            'credit_points' => $request->credit_points,
            'semester' => $request->semester,
            'type' => $request->type,
            'department_id' => $request->department_id,
            'level_id' => $request->level_id,
            'admin_id' => $request->user()->id,
            'job_title' => $request->job_title,
        ]);

        $this->notifyAdmin(
            'Account created',
            'Account "' . $user->name . '" has been created (' . ($user->isProfessor() ? 'professor' : 'student') . ').'
        );

        return SendResponse(201, 'Account created successfully.');
    }

    public function getUserById(Request $request, $id)
    {
        $user = User::with(['admin', 'department', 'level'])->find($id);

        if (! $user) {
            return SendResponse(404, 'User not found.');
        }

        return SendResponse(200, 'User fetched successfully.', new UserResource($user));
    }

    public function delete(Request $request, $id)
    {
        $user = User::find($id);

        if (! $user) {
            return SendResponse(404, 'User not found.');
        }

        $user->delete();

        return SendResponse(200, 'User deleted successfully.');
    }

    public function update(AdminUpdateUserRequest $request)
    {
        $user = User::find($request->account_id);

        if (! $user) {
            return SendResponse(404, 'User not found.');
        }

        $data = [
            'name' => $request->input('name', $user->name),
            'email' => $request->input('email', $user->email),
            'gender' => $request->input('gender', $user->gender),
            'nationalid' => $request->input('nationalid', $user->nationalid),
            'phone' => $request->input('phone', $user->phone),
            'credit_points' => $request->input('credit_points', $user->credit_points),
            'semester' => $request->input('semester', $user->semester),
            'type' => $request->input('type', $user->type),
            'department_id' => $request->input('department_id', $user->department_id),
            'level_id' => $request->input('level_id', $user->level_id),
            'job_title' => $request->input('job_title', $user->job_title),
        ];

        if ($request->filled('password')) {
            $data['password'] = Hash::make($request->password);
        }

        $user->update($data);

        return SendResponse(200, 'User updated successfully.');
    }

    private function formatUser(User $user, bool $isProfessor): array
    {
        $base = [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'gender' => $user->gender ? 'Female' : 'Male',
            'nationalid' => $user->nationalid,
            'phone' => $user->phone,
            'credit_points' => $user->credit_points,
            'type' => $user->type,
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
            'created_by' => $user->admin?->name,
        ];

        if ($isProfessor) {
            return $base + ['job_title' => $user->job_title];
        }

        return $base + [
            'semester' => $user->semester,
            'department' => $user->department?->name,
            'level' => $user->level?->name,
        ];
    }
}
