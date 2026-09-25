<?php

namespace App\Http\Requests\Professor;

use App\Traits\FetchRequestError;
use Illuminate\Foundation\Http\FormRequest;

class ProfessorAddQuizRequest extends FormRequest
{
    use FetchRequestError;

    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'name' => 'required|min:1|max:50',
            'pdf' => 'required|file|mimes:pdf',
            'course_id' => 'required|exists:courses,id',
            'due_at' => 'nullable|date|after_or_equal:today',
        ];
    }
}