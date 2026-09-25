<?php

namespace App\Http\Requests\Admin;

use App\Traits\FetchRequestError;
use Illuminate\Foundation\Http\FormRequest;

class AdminAddCourseRequest extends FormRequest
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
            'course_name' => 'required|string|max:255',
            'no_of_hours' => 'required|integer|min:1',
            'course_code' => 'required|string|max:255|unique:courses,course_code',
            'cover_image' => 'nullable|image|mimes:jpeg,png,jpg,gif,svg|max:2048',
            'department_id' => 'nullable|exists:departments,id',
            'professor_id' => 'required|exists:users,id',
            'semester_id' => 'nullable|exists:semesters,id'
        ];
    }
}
