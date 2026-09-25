<?php

namespace App\Http\Requests;

use App\Traits\FetchRequestError;
use Illuminate\Foundation\Http\FormRequest;

class AccessRequestStoreRequest extends FormRequest
{
    use FetchRequestError;

    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255',
            'password' => 'required|string|min:6',
            'gender' => 'required|boolean',
            'phone' => 'nullable|string|size:11',
            'national_id' => 'nullable|string|size:14',
            'level_id' => 'exists:levels,id',
            'department_id' => 'exists:departments,id',
        ];
    }
}