<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AccessRequestApprovedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $recipientName,
        public string $email,
        public string $loginUrl,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Your UniversTech access request was approved',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.access-request-approved',
            with: [
                'name' => $this->recipientName,
                'email' => $this->email,
                'loginUrl' => $this->loginUrl,
            ],
        );
    }
}
