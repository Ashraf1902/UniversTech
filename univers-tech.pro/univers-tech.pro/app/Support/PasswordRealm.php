<?php

namespace App\Support;

use App\Models\Admin;
use App\Models\User;

/**
 * Maps the three authentication realms (student, professor, admin) onto the
 * Laravel password-broker / user-provider configuration and frontend URLs.
 */
class PasswordRealm
{
    public const STUDENT = 'student';
    public const PROFESSOR = 'professor';
    public const ADMIN = 'admin';

    /**
     * @return array<int, string>
     */
    public static function all(): array
    {
        return [self::STUDENT, self::PROFESSOR, self::ADMIN];
    }

    public static function broker(string $realm): string
    {
        return $realm === self::ADMIN ? 'admins' : 'users';
    }

    /**
     * @return class-string<User|Admin>
     */
    public static function model(string $realm): string
    {
        return $realm === self::ADMIN ? Admin::class : User::class;
    }

    public static function realmForModel(object $model): string
    {
        if ($model instanceof Admin) {
            return self::ADMIN;
        }

        if (method_exists($model, 'isProfessor') && $model->isProfessor()) {
            return self::PROFESSOR;
        }

        return self::STUDENT;
    }

    public static function resetUrl(string $realm, string $email, string $token): string
    {
        return self::frontend('/reset-password') . '?' . http_build_query([
            'token' => $token,
            'email' => $email,
            'role' => $realm,
        ]);
    }

    public static function loginUrl(string $realm = self::STUDENT): string
    {
        return self::frontend('/login') . '?' . http_build_query(['role' => $realm]);
    }

    private static function frontend(string $path): string
    {
        return rtrim((string) config('app.frontend_url'), '/') . $path;
    }
}
