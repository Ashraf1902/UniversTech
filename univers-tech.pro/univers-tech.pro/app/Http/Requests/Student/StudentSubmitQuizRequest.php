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
            'file' => 'required_without:answer_text|nullable|file|mimes:pdf,jpg,jpeg,png,doc,docx|max:' . $maxKb,
            'answer_text' => 'required_without:file|nullable|string|max:20000',
        ];
    }
}
