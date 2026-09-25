<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function login(LoginRequest $request)
    {
        if (! Auth::attempt($request->only('email', 'password'))) {
            return SendResponse(401, 'Invalid credentials.');
        }

        $user = Auth::user();

        if (! $user->isStudent()) {
            return SendResponse(403, 'This account is not a student account.');
        }

        $token = $user->createToken('student-token')->plainTextToken;

        return SendResponse(200, 'Logged in successfully.', [
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
        ]);
    }
}