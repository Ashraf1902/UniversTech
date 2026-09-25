<?php

namespace App\Http\Requests;

use App\Traits\FetchRequestError;
use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
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
            'email' => 'required|email|exists:users',
            'password' => 'required',
        ];
    }

    /**
     * Get the validation messages that apply to the request.
     *
     * @return array<string, mixed>
     */

    public function messages()
    {
        return [
            'email.exists' => 'Email is not registered yet.',
        ];
    }


}
