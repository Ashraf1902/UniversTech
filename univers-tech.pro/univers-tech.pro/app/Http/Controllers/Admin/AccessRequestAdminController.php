<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminRespondAccessRequest;
use App\Mail\AccessRequestApprovedMail;
use App\Mail\AccessRequestRejectedMail;
use App\Models\AccessRequest;
use App\Models\User;
use App\Support\ActivityLogger;
use App\Support\PasswordRealm;
use App\Traits\Notifiable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class AccessRequestAdminController extends Controller
{
    use Notifiable;

    public function index(Request $request)
    {
        $query = AccessRequest::query()->with(['level', 'department', 'admin']);

        if (in_array($request->status, [
            AccessRequest::STATUS_PENDING,
            AccessRequest::STATUS_ACCEPTED,
            AccessRequest::STATUS_REFUSED,
        ], true)) {
            $query->where('status', $request->status);
        }

        $requests = $query->orderByDesc('created_at')
            ->paginate(15)
            ->through(fn (AccessRequest $item) => $this->format($item));

        return SendResponse(200, 'Access requests fetched successfully.', $requests);
    }

    public function respond(AdminRespondAccessRequest $request)
    {
        $accessRequest = AccessRequest::find($request->id);

        if ($accessRequest->status !== AccessRequest::STATUS_PENDING) {
            return SendResponse(422, 'This request has already been processed.');
        }

        if ($request->action === 'accept') {
            if (User::withTrashed()->where('email', $accessRequest->email)->exists()) {
                return SendResponse(409, 'A user with this email already exists.');
            }

            $userId = DB::transaction(function () use ($accessRequest, $request) {
                $user = User::create([
                    'name' => $accessRequest->name,
                    'email' => $accessRequest->email,
                    'password' => $accessRequest->password,
                    'gender' => $accessRequest->gender,
                    'nationalid' => $accessRequest->national_id,
                    'phone' => $accessRequest->phone,
                    'type' => User::TYPE_STUDENT,
                    'admin_id' => $request->user()->id,
                ]);

                $user->student()->create([
                    'department_id' => $accessRequest->department_id,
                    'level_id' => $accessRequest->level_id,
                ]);

                $accessRequest->update([
                    'status' => AccessRequest::STATUS_ACCEPTED,
                    'decided_at' => now(),
                    'admin_id' => $request->user()->id,
                ]);

                return $user->id;
            });

            $this->notifyStudent(
                $userId,
                'Welcome to UniversTech',
                'Your registration request was accepted. Sign in with the password you chose.'
            );

            $this->notifyAdmin(
                'Access request accepted',
                'The request from "' . $accessRequest->name . '" was accepted and an account was created.'
            );

            Mail::to($accessRequest->email)->queue(new AccessRequestApprovedMail(
                $accessRequest->name,
                $accessRequest->email,
                PasswordRealm::loginUrl(PasswordRealm::STUDENT),
            ));

            ActivityLogger::log(ActivityLogger::ACCESS_REQUEST_ACCEPTED, $accessRequest, [
                'email' => $accessRequest->email,
                'user_id' => $userId,
            ], $request->user());

            return SendResponse(200, 'Request accepted. A student account was created.', [
                'user_id' => $userId,
            ]);
        }

        $accessRequest->update([
            'status' => AccessRequest::STATUS_REFUSED,
            'decided_at' => now(),
            'admin_id' => $request->user()->id,
            'rejection_reason' => $request->input('reason'),
        ]);

        $this->notifyAdmin(
            'Access request refused',
            'The request from "' . $accessRequest->name . '" was refused.'
        );

        Mail::to($accessRequest->email)->queue(new AccessRequestRejectedMail(
            $accessRequest->name,
            $request->input('reason'),
            PasswordRealm::loginUrl(PasswordRealm::STUDENT),
        ));

        ActivityLogger::log(ActivityLogger::ACCESS_REQUEST_REFUSED, $accessRequest, [
            'email' => $accessRequest->email,
            'reason' => $request->input('reason'),
        ], $request->user());

        return SendResponse(200, 'Request refused.');
    }

    private function format(AccessRequest $item): array
    {
        return [
            'id' => $item->id,
            'name' => $item->name,
            'email' => $item->email,
            'phone' => $item->phone,
            'national_id' => $item->national_id,
            'gender' => $item->gender ? 'Female' : 'Male',
            'level' => $item->level?->name,
            'department' => $item->department?->name,
            'status' => $item->status,
            'created_at' => $item->created_at,
            'decided_at' => $item->decided_at,
            'decided_by' => $item->admin?->name,
            'rejection_reason' => $item->rejection_reason,
        ];
    }
}