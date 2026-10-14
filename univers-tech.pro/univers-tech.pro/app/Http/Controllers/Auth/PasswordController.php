<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\ChangePasswordRequest;
use App\Http\Requests\ForgotPasswordRequest;
use App\Http\Requests\ResetPasswordRequest;
use App\Mail\ResetPasswordMail;
use App\Support\ActivityLogger;
use App\Support\PasswordRealm;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;

class PasswordController extends Controller
{
    /**
     * Always return the same message so the endpoint cannot be used to
     * enumerate registered email addresses.
     */
    private const GENERIC_RESET_MESSAGE = 'If an account exists for that email address, a password reset link has been sent.';

    public function forgot(ForgotPasswordRequest $request)
    {
        $realm = $this->realm($request);

        Password::broker(PasswordRealm::broker($realm))->sendResetLink(
            ['email' => $request->input('email')],
            function ($user, string $token) use ($realm) {
                $email = $user->getEmailForPasswordReset();

                Mail::to($email)->queue(new ResetPasswordMail(
                    (string) ($user->name ?? 'there'),
                    PasswordRealm::resetUrl($realm, $email, $token),
                    $realm,
                ));
            }
        );

        return SendResponse(200, self::GENERIC_RESET_MESSAGE);
    }

    public function reset(ResetPasswordRequest $request)
    {
        $realm = $this->realm($request);

        $status = Password::broker(PasswordRealm::broker($realm))->reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function ($user, string $password) use ($realm) {
                $this->applyPassword($user, $password);
                $this->revokeAllTokens($user);

                ActivityLogger::log(ActivityLogger::PASSWORD_RESET, $user, [
                    'email' => $user->getEmailForPasswordReset(),
                    'realm' => $realm,
                ]);
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            $message = match ($status) {
                Password::INVALID_TOKEN => 'This password reset link is invalid or has expired.',
                Password::INVALID_USER => 'We could not find an account for that email address.',
                Password::RESET_THROTTLED => 'Please wait a moment before trying again.',
                default => 'Unable to reset the password. Please request a new link.',
            };

            return SendResponse(422, $message);
        }

        return SendResponse(200, 'Your password has been reset. You can now sign in with your new password.');
    }

    public function change(ChangePasswordRequest $request)
    {
        $user = $request->user();

        if (! Hash::check($request->input('current_password'), $user->password)) {
            return SendResponse(422, 'Your current password is incorrect.');
        }

        $this->applyPassword($user, $request->input('password'));
        $this->revokeOtherTokens($user);

        ActivityLogger::log(ActivityLogger::PASSWORD_CHANGED, $user, [
            'realm' => PasswordRealm::realmForModel($user),
        ], $user);

        return SendResponse(200, 'Your password has been updated.');
    }

    private function applyPassword($user, string $password): void
    {
        $user->forceFill(['password' => Hash::make($password)])->save();
    }

    private function revokeAllTokens($user): void
    {
        if (method_exists($user, 'tokens')) {
            $user->tokens()->delete();
        }
    }

    /**
     * Revoke every token except the one used for the current request so the
     * active session is kept but other devices are signed out.
     */
    private function revokeOtherTokens($user): void
    {
        if (! method_exists($user, 'tokens')) {
            return;
        }

        $token = method_exists($user, 'currentAccessToken') ? $user->currentAccessToken() : null;
        $tokenId = $token->id ?? null;

        if ($tokenId) {
            $user->tokens()->where('id', '!=', $tokenId)->delete();
        } else {
            $user->tokens()->delete();
        }
    }

    private function realm(Request $request): string
    {
        $realm = $request->route('realm');

        return in_array($realm, PasswordRealm::all(), true) ? $realm : PasswordRealm::STUDENT;
    }
}
