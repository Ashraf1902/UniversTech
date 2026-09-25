<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\User;
use Illuminate\Http\Request;

class FactsController extends Controller
{
    public function __invoke(Request $request)
    {
        $facts = [
            'students' => User::where('type', User::TYPE_STUDENT)->count(),
            'professors' => User::where('type', User::TYPE_PROFESSOR)->count(),
            'departments' => Department::count(),
        ];

        return SendResponse(200, 'Facts fetched successfully.', $facts);
    }
}