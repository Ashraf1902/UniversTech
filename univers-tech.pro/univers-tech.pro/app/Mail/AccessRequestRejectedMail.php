<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AccessRequestRejectedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $recipientName,
        public ?string $reason,
        public string $loginUrl,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Update on your UniversTech access request',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.access-request-rejected',
            with: [
                'name' => $this->recipientName,
                'reason' => $this->reason,
                'loginUrl' => $this->loginUrl,
            ],
        );
    }
}
