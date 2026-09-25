<?php

namespace App\Http\Requests\Admin;

use App\Traits\FetchRequestError;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdminUpdateUserRequest extends FormRequest
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
        $userId = $this->input('account_id');

        return [
            'account_id' => 'required|exists:users,id',
            'name' => 'string|max:255',
            'email' => ['string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($userId)],
            'password' => 'string|min:8',
            'gender' => 'boolean',
            'nationalid' => 'string|size:14',
            'phone' => ['string', 'size:11', Rule::unique('users', 'phone')->ignore($userId)],
            'credit_points' => 'integer',
            'semester' => 'in:first,second',
            'type' => 'boolean',
            'department_id' => 'exists:departments,id',
            'level_id' => 'exists:levels,id',
            'job_title' => 'min:3|max:50'
        ];
    }
}
