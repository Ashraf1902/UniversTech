<?php

namespace App\Http\Requests\Admin;

use App\Traits\FetchRequestError;
use Illuminate\Foundation\Http\FormRequest;

class StoreAttendanceRequest extends FormRequest
{
    use FetchRequestError;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'student_id' => 'required|exists:users,id',
            'lecture_id' => 'required|exists:lectures,id',
            'date' => 'required|date',
            'status' => 'required|boolean',
            'reason' => 'nullable|string|max:500',
        ];
    }
}
