<?php

namespace App\Http\Controllers\API\Student;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function __invoke(Request $request)
    {
        return SendResponse(
            200,
            'Profile fetched successfully.',
            new UserResource($request->user())
        );
    }
}