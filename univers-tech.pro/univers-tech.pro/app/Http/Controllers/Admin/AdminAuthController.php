<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminLoginRequest;
use App\Models\Admin;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AdminAuthController extends Controller
{
    public function login(AdminLoginRequest $request)
    {
        $admin = Admin::where('email', $request->email)->first();

        if (! $admin || ! Hash::check($request->password, $admin->password)) {
            return SendResponse(401, 'Invalid credentials.');
        }

        $token = $admin->createToken('admin-token')->plainTextToken;

        return SendResponse(200, 'Logged in successfully.', [
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => [
                'id' => $admin->id,
                'name' => $admin->name,
                'email' => $admin->email,
                'is_super_admin' => $admin->is_super_admin,
                'roles' => $admin->roles ?? [],
            ],
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return SendResponse(200, 'Logged out successfully.');
    }

    public function me(Request $request)
    {
        return SendResponse(200, 'Admin profile fetched successfully.', [
            'id' => $request->user()->id,
            'name' => $request->user()->name,
            'email' => $request->user()->email,
            'is_super_admin' => $request->user()->is_super_admin,
            'roles' => $request->user()->roles ?? [],
            'created_at' => $request->user()->created_at,
        ]);
    }
}