<?php

namespace App\Http\Requests\Professor;

use App\Traits\FetchRequestError;
use Illuminate\Foundation\Http\FormRequest;

class ProfessorGradeQuizSubmissionRequest extends FormRequest
{
    use FetchRequestError;

    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'submission_id' => 'required|integer|exists:quiz_submissions,id',
            'score' => 'required|numeric|min:0',
            'feedback' => 'nullable|string|max:5000',
        ];
    }
}
