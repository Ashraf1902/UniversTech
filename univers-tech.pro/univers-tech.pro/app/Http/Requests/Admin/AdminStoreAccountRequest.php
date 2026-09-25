<?php

namespace App\Http\Requests\Admin;

use App\Traits\FetchRequestError;
use Illuminate\Foundation\Http\FormRequest;

class AdminStoreAccountRequest extends FormRequest
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
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email',
            'password' => 'required|string|min:8',
            'gender' => 'required|boolean',
            'nationalid' => 'nullable|string|size:14',
            'phone' => 'nullable|string|size:11|unique:users,phone',
            'credit_points' => 'nullable|integer',
            'semester' => 'in:first,second',
            'type' => 'required|boolean',
            'department_id' => 'exists:departments,id',
            'level_id' => 'exists:levels,id',
            'job_title' => 'min:3|max:50'
        ];
    }
}
