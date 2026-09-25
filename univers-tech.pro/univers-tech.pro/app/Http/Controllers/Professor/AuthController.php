<?php

namespace App\Http\Controllers\Professor;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(LoginRequest $request)
    {
        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return SendResponse(401, 'Invalid credentials.');
        }

        if (! $user->isProfessor()) {
            return SendResponse(403, 'This account is not a professor account.');
        }

        $token = $user->createToken('professor-token')->plainTextToken;

        return SendResponse(200, 'Logged in successfully.', [
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'job_title' => $user->job_title,
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
        return SendResponse(200, 'Professor profile fetched successfully.', new UserResource($request->user()));
    }
}
