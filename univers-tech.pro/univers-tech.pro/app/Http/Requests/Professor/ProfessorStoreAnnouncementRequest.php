<?php

namespace App\Http\Requests\Professor;

use App\Traits\FetchRequestError;
use Illuminate\Foundation\Http\FormRequest;

class ProfessorStoreAnnouncementRequest extends FormRequest
{
    use FetchRequestError;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'course_id' => 'required|exists:courses,id',
            'title' => 'required|string|max:150',
            'body' => 'required|string|max:5000',
            'attachment' => 'nullable|file|mimes:pdf,doc,docx,ppt,pptx,xls,xlsx,txt,zip,jpeg,png,jpg,gif,webp|max:10240',
        ];
    }
}
