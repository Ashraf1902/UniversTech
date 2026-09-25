<?php

namespace App\Http\Requests\Admin;

use App\Traits\FetchRequestError;
use Illuminate\Foundation\Http\FormRequest;

class AdminRespondAccessRequest extends FormRequest
{
    use FetchRequestError;

    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'id' => 'required|exists:access_requests,id',
            'action' => 'required|in:accept,refuse',
        ];
    }
}