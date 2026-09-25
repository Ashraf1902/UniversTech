<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminStoreAccountRequest;
use App\Http\Requests\Admin\AdminUpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Traits\Notifiable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class AccountAdminController extends Controller
{
    use Notifiable;

    public function getDoctors(Request $request)
    {
        $doctors = $this->userQuery(User::TYPE_PROFESSOR, $request->boolean('deleted'))
            ->orderByDesc('created_at')
            ->with(['admin', 'student', 'professor.department'])
            ->paginate(15)
            ->through(fn (User $user) => $this->formatUser($user, true));

        return SendResponse(200, 'Professors fetched successfully.', $doctors);
    }

    public function getStudents(Request $request)
    {
        $students = $this->userQuery(User::TYPE_STUDENT, $request->boolean('deleted'))
            ->orderByDesc('created_at')
            ->with(['admin', 'student.department', 'student.level'])
            ->paginate(15)
            ->through(fn (User $user) => $this->formatUser($user, false));

        return SendResponse(200, 'Students fetched successfully.', $students);
    }

    private function userQuery(int $type, bool $deleted)
    {
        return $deleted
            ? User::onlyTrashed()->where('type', $type)
            : User::where('type', $type);
    }

    public function store(AdminStoreAccountRequest $request)
    {
        DB::transaction(function () use ($request) {
            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'gender' => $request->gender,
                'nationalid' => $request->nationalid,
                'phone' => $request->phone,
                'type' => $request->type,
                'admin_id' => $request->user()->id,
            ]);

            if ($user->isStudent()) {
                $user->student()->create([
                    'department_id' => $request->department_id,
                    'level_id' => $request->level_id,
                    'semester' => $request->semester,
                    'credit_points' => $request->credit_points,
                ]);
            } else {
                $user->professor()->create([
                    'department_id' => $request->department_id,
                    'job_title' => $request->job_title,
                ]);
            }

            $this->notifyAdmin(
                'Account created',
                'Account "' . $user->name . '" has been created (' . ($user->isProfessor() ? 'professor' : 'student') . ').'
            );
        });

        return SendResponse(201, 'Account created successfully.');
    }

    public function getUserById(Request $request, $id)
    {
        $user = User::with(['admin', 'student.department', 'student.level', 'professor.department'])->find($id);

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

        return SendResponse(200, 'User archived, can be restored later.');
    }

    public function restore(Request $request, $id)
    {
        $user = User::onlyTrashed()->find($id);

        if (! $user) {
            return SendResponse(404, 'Archived user not found.');
        }

        $user->restore();

        return SendResponse(200, 'User restored successfully.');
    }

    public function purge(Request $request, $id)
    {
        if (! $request->user()->isSuperAdmin()) {
            return SendResponse(403, 'Only a super admin can permanently delete accounts.');
        }

        $user = User::withTrashed()->find($id);

        if (! $user) {
            return SendResponse(404, 'User not found.');
        }

        $user->forceDelete();

        return SendResponse(200, 'User permanently deleted.');
    }

    public function update(AdminUpdateUserRequest $request)
    {
        $user = User::find($request->account_id);

        if (! $user) {
            return SendResponse(404, 'User not found.');
        }

        DB::transaction(function () use ($request, $user) {
            $data = [
                'name' => $request->input('name', $user->name),
                'email' => $request->input('email', $user->email),
                'gender' => $request->input('gender', $user->gender),
                'nationalid' => $request->input('nationalid', $user->nationalid),
                'phone' => $request->input('phone', $user->phone),
                'type' => $request->input('type', $user->type),
            ];

            if ($request->filled('password')) {
                $data['password'] = Hash::make($request->password);
            }

            $user->update($data);

            if ($user->isStudent()) {
                $user->student()->updateOrCreate([], [
                    'department_id' => $request->input('department_id', $user->student?->department_id),
                    'level_id' => $request->input('level_id', $user->student?->level_id),
                    'semester' => $request->input('semester', $user->student?->semester),
                    'credit_points' => $request->input('credit_points', $user->student?->credit_points),
                ]);
            } else {
                $user->professor()->updateOrCreate([], [
                    'department_id' => $request->input('department_id', $user->professor?->department_id),
                    'job_title' => $request->input('job_title', $user->professor?->job_title),
                ]);
            }
        });

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
            'credit_points' => $user->student?->credit_points,
            'type' => $user->type,
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
            'deleted_at' => $user->deleted_at,
            'created_by' => $user->admin?->name,
        ];

        if ($isProfessor) {
            return $base + ['job_title' => $user->professor?->job_title];
        }

        return $base + [
            'semester' => $user->student?->semester,
            'department' => $user->student?->department?->name,
            'level' => $user->student?->level?->name,
        ];
    }
}
