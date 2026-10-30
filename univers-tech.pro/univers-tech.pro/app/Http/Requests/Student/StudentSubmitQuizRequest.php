<?php

namespace App\Http\Requests\Student;

use App\Support\Settings;
use App\Traits\FetchRequestError;
use Illuminate\Foundation\Http\FormRequest;

class StudentSubmitQuizRequest extends FormRequest
{
    use FetchRequestError;

    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        $maxKb = Settings::quizSubmissionMaxKb();

        return [
            'file' => [
                'required_without:answer_text',
                'nullable',
                'file',
                // Extension allowlist plus the real (content-sniffed) MIME
                // type, so a renamed executable is still rejected.
                'mimes:pdf,jpg,jpeg,png,doc,docx',
                'mimetypes:application/pdf,image/jpeg,image/png,application/msword,'
                    . 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'max:' . $maxKb,
            ],
            'answer_text' => 'required_without:file|nullable|string|max:20000',
        ];
    }
}
