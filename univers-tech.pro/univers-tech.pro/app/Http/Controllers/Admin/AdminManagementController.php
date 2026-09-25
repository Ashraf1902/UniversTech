<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Admin;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AdminManagementController extends Controller
{
    private const VALID_SCOPES = ['accounts', 'access_requests', 'departments', 'courses', 'semesters', 'schedules', 'events', 'grades'];

    private function authorizeSuper(Request $request)
    {
        if (! $request->user()->isSuperAdmin()) {
            return SendResponse(403, 'Only a super admin can manage administrator accounts.');
        }

        return null;
    }

    private function normalizeRoles(array $roles): array
    {
        return array_values(array_unique(array_filter(
            $roles,
            fn ($role) => in_array($role, self::VALID_SCOPES, true)
        )));
    }

    public function index(Request $request)
    {
        $blocked = $this->authorizeSuper($request);
        if ($blocked) {
            return $blocked;
        }

        $admins = Admin::orderByDesc('is_super_admin')->orderBy('created_at')->get();

        return SendResponse(200, 'Admins fetched successfully.', $admins->map(fn (Admin $admin) => [
            'id' => $admin->id,
            'name' => $admin->name,
            'email' => $admin->email,
            'is_super_admin' => $admin->is_super_admin,
            'roles' => $admin->roles ?? [],
            'created_at' => $admin->created_at,
        ]));
    }

    public function store(Request $request)
    {
        $blocked = $this->authorizeSuper($request);
        if ($blocked) {
            return $blocked;
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:50'],
            'email' => ['required', 'email', 'max:50', 'unique:admins,email'],
            'password' => ['required', 'string', 'min:6'],
            'roles' => ['nullable', 'array'],
            'roles.*' => ['string'],
        ]);

        $admin = Admin::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'is_super_admin' => false,
            'roles' => $this->normalizeRoles($data['roles'] ?? []),
        ]);

        return SendResponse(201, 'Admin created successfully.', [
            'id' => $admin->id,
            'name' => $admin->name,
            'email' => $admin->email,
            'is_super_admin' => $admin->is_super_admin,
            'roles' => $admin->roles ?? [],
        ]);
    }

    public function update(Request $request)
    {
        $blocked = $this->authorizeSuper($request);
        if ($blocked) {
            return $blocked;
        }

        $data = $request->validate([
            'id' => ['required', 'integer', 'exists:admins,id'],
            'name' => ['nullable', 'string', 'max:50'],
            'password' => ['nullable', 'string', 'min:6'],
            'roles' => ['nullable', 'array'],
            'roles.*' => ['string'],
        ]);

        $admin = Admin::findOrFail($data['id']);

        if ($admin->id === $request->user()->id) {
            return SendResponse(409, 'You cannot modify your own account here.');
        }

        if ($admin->is_super_admin) {
            return SendResponse(409, 'Super admin accounts cannot be modified.');
        }

        $admin->update([
            'name' => $data['name'] ?? $admin->name,
            'roles' => $this->normalizeRoles($data['roles'] ?? []),
        ]);

        if (! empty($data['password'])) {
            $admin->update(['password' => Hash::make($data['password'])]);
        }

        return SendResponse(200, 'Admin updated successfully.');
    }

    public function delete(Request $request, $id)
    {
        $blocked = $this->authorizeSuper($request);
        if ($blocked) {
            return $blocked;
        }

        $admin = Admin::find($id);

        if (! $admin) {
            return SendResponse(404, 'Admin not found.');
        }

        if ($admin->id === $request->user()->id) {
            return SendResponse(409, 'You cannot delete your own account.');
        }

        if ($admin->is_super_admin) {
            return SendResponse(409, 'Super admin accounts cannot be deleted.');
        }

        $admin->delete();

        return SendResponse(200, 'Admin deleted successfully.');
    }
}