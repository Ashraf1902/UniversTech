<?php

namespace Tests\Feature;

use App\Mail\AccessRequestApprovedMail;
use App\Mail\AccessRequestRejectedMail;
use App\Mail\ResetPasswordMail;
use Tests\TestCase;

class MailablesTest extends TestCase
{
    public function test_reset_password_mail_renders(): void
    {
        $mail = new ResetPasswordMail('Aya', 'https://app.test/reset-password?token=abc', 'student');

        $this->assertStringContainsString('https://app.test/reset-password?token=abc', $mail->render());
    }

    public function test_access_request_approved_mail_renders(): void
    {
        $mail = new AccessRequestApprovedMail('Aya', 'aya@example.com', 'https://app.test/login');

        $html = $mail->render();
        $this->assertStringContainsString('aya@example.com', $html);
        $this->assertStringContainsString('https://app.test/login', $html);
    }

    public function test_access_request_rejected_mail_renders_with_and_without_reason(): void
    {
        $withReason = new AccessRequestRejectedMail('Aya', 'Incomplete documents.', 'https://app.test/login');
        $this->assertStringContainsString('Incomplete documents.', $withReason->render());

        $withoutReason = new AccessRequestRejectedMail('Aya', null, 'https://app.test/login');
        $this->assertNotEmpty($withoutReason->render());
    }
}
