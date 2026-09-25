<?php

namespace App\Http\Requests\Professor;

use App\Traits\FetchRequestError;
use Illuminate\Foundation\Http\FormRequest;

class ProfessorAddLectureRequest extends FormRequest
{
    use FetchRequestError;
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize()
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, mixed>
     */
    public function rules()
    {
        return [
            'name' => 'required|min:1|max:50',
            'pdf' => 'required|file|mimes:pdf',
            'course_id' => 'required|exists:courses,id'
        ];
    }
}
