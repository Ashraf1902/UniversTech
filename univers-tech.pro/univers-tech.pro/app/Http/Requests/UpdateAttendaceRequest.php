<?php

namespace App\Http\Requests;

use App\Traits\FetchRequestError;
use Illuminate\Foundation\Http\FormRequest;

class UpdateAttendaceRequest extends FormRequest
{
    use FetchRequestError;

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'attendance_id' => 'required|exists:attendances,id',
            'date' => 'required|date',
            'status' => 'required|boolean',
            'reason' => 'nullable|string',
        ];
    }
}
