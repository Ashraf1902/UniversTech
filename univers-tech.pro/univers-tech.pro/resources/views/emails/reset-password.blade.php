<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Reset your UniversTech password</title>
</head>
<body style="margin:0;padding:0;background:#0b1020;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1020;padding:32px 12px;">
    <tr>
        <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
                <tr>
                    <td style="padding:28px 32px;background:linear-gradient(135deg,#6d28d9,#0891b2);color:#ffffff;">
                        <div style="font-size:20px;font-weight:700;">UniversTech</div>
                    </td>
                </tr>
                <tr>
                    <td style="padding:32px;color:#1f2937;font-size:15px;line-height:1.6;">
                        <p style="margin:0 0 16px;">Hello {{ $name }},</p>
                        <p style="margin:0 0 24px;">
                            We received a request to reset the password for your UniversTech
                            <strong>{{ ucfirst($realm) }}</strong> account. This link expires in 60 minutes.
                        </p>
                        <p style="margin:0 0 28px;text-align:center;">
                            <a href="{{ $resetUrl }}"
                               style="display:inline-block;padding:14px 28px;background:#6d28d9;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;">
                                Reset password
                            </a>
                        </p>
                        <p style="margin:0 0 12px;color:#6b7280;font-size:13px;">
                            If the button does not work, copy and paste this address into your browser:
                        </p>
                        <p style="margin:0 0 24px;word-break:break-all;color:#4f46e5;font-size:13px;">{{ $resetUrl }}</p>
                        <p style="margin:0;color:#6b7280;font-size:13px;">
                            If you did not request a password reset, you can safely ignore this email.
                        </p>
                    </td>
                </tr>
                <tr>
                    <td style="padding:18px 32px;background:#f3f4f6;color:#9ca3af;font-size:12px;text-align:center;">
                        &copy; {{ date('Y') }} UniversTech. All rights reserved.
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
