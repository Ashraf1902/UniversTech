<?php

namespace App\Http\Requests\Admin;

use App\Traits\FetchRequestError;
use Illuminate\Foundation\Http\FormRequest;

class AdminUpdateEventRequest extends FormRequest
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
            'event_id' => 'required|exists:events,id',
            'title' => 'min:1|max:50',
            'content' => 'min:1',
            'image' => 'image|mimes:jpeg,png,jpg,gif,svg,webp|max:5120',
        ];
    }
}
