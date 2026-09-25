<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminLoginRequest;
use App\Models\Admin;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;
use Laravel\Sanctum\PersonalAccessToken;

class AdminAuthController extends Controller
{
    public function login(AdminLoginRequest $request)
    {
        $admin = Admin::where('email', $request->email)->first();

        if (! $admin || ! Hash::check($request->password, $admin->password)) {
            return SendResponse(401, 'Invalid credentials.');
        }

        $adminData = [
            'id' => $admin->id,
            'name' => $admin->name,
            'email' => $admin->email,
            'is_super_admin' => $admin->is_super_admin,
            'roles' => $admin->roles ?? [],
        ];

        if (EnsureFrontendRequestsAreStateful::fromFrontend($request)) {
            Auth::guard('web-admin')->login($admin);
            $request->session()->regenerate();

            return SendResponse(200, 'Logged in successfully.', ['user' => $adminData]);
        }

        $token = $admin->createToken('admin-token')->plainTextToken;

        return SendResponse(200, 'Logged in successfully.', [
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $adminData,
        ]);
    }

    public function logout(Request $request)
    {
        $admin = $request->user();

        if ($admin) {
            $token = $admin->currentAccessToken();

            if ($token instanceof PersonalAccessToken) {
                $token->delete();
            }
        }

        Auth::guard('web-admin')->logout();
        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

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