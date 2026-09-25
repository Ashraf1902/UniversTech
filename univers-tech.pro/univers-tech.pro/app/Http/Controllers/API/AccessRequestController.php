<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Requests\AccessRequestStoreRequest;
use App\Models\AccessRequest;
use App\Models\User;
use App\Traits\Notifiable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AccessRequestController extends Controller
{
    use Notifiable;

    public function store(AccessRequestStoreRequest $request)
    {
        if (User::where('email', $request->email)->exists()) {
            return SendResponse(409, 'This email is already registered. Please sign in instead.');
        }

        if (AccessRequest::where('email', $request->email)->where('status', AccessRequest::STATUS_PENDING)->exists()) {
            return SendResponse(409, 'A pending request already exists for this email. Please wait for the administration.');
        }

        $accessRequest = AccessRequest::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'phone' => $request->phone,
            'national_id' => $request->national_id,
            'gender' => $request->gender,
            'level_id' => $request->level_id,
            'department_id' => $request->department_id,
            'status' => AccessRequest::STATUS_PENDING,
        ]);

        $this->notifyAdmin(
            'New access request',
            '"' . $accessRequest->name . '" requested access as a student (' . $accessRequest->email . ').'
        );

        return SendResponse(201, 'Your request has been submitted. The administration will review it shortly.');
    }
}