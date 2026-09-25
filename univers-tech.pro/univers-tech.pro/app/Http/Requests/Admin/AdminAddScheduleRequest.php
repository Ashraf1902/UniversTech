<?php

namespace App\Http\Requests\Admin;

use App\Traits\FetchRequestError;
use Illuminate\Foundation\Http\FormRequest;

class AdminAddScheduleRequest extends FormRequest
{
    use FetchRequestError;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'level_id' => 'required|exists:levels,id',
            'semester_id' => 'required|exists:semesters,id',
            'department_id' => 'nullable|exists:departments,id',
            'course_id' => 'required|exists:courses,id',
            'day_of_week' => 'required|string|in:Saturday,Sunday,Monday,Tuesday,Wednesday,Thursday,Friday',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'section_type' => 'required|string|in:lecture,seminar,lab',
            'image' => 'nullable|mimes:jpeg,png,jpg,gif,svg|max:2048',
        ];
    }
}
