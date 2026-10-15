<?php

namespace App\Http\Requests\Professor;

use App\Traits\FetchRequestError;
use Illuminate\Foundation\Http\FormRequest;

class ProfessorUpdateAnnouncementRequest extends FormRequest
{
    use FetchRequestError;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'announcement_id' => 'required|exists:announcements,id',
            'title' => 'sometimes|string|max:150',
            'body' => 'sometimes|string|max:5000',
            'attachment' => 'nullable|file|mimes:pdf,doc,docx,ppt,pptx,xls,xlsx,txt,zip,jpeg,png,jpg,gif,webp|max:10240',
        ];
    }
}
