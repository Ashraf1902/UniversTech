<?php

namespace App\Http\Requests\Professor;

use App\Traits\FetchRequestError;
use Illuminate\Foundation\Http\FormRequest;

/**
 * One-shot attendance for a whole class, scoped to a single lecture.
 *
 * The endpoint is additive: the existing single-student attendance routes are
 * unchanged. A class save is capped so a malformed payload cannot turn into an
 * unbounded write loop.
 */
class ProfessorBulkAttendanceRequest extends FormRequest
{
    use FetchRequestError;

    public const MAX_ROWS = 200;

    public function authorize()
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules()
    {
        return [
            'lecture_id' => 'required|integer|exists:lectures,id',
            'date' => 'required|date',
            'attendances' => 'required|array|min:1|max:' . self::MAX_ROWS,
            'attendances.*.student_id' => 'required|integer|distinct|exists:users,id',
            'attendances.*.status' => 'required|boolean',
            'attendances.*.reason' => 'nullable|string|max:500',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages()
    {
        return [
            'attendances.max' => 'A single attendance save can cover at most ' . self::MAX_ROWS . ' students.',
            'attendances.*.student_id.distinct' => 'Each student can only appear once in an attendance save.',
        ];
    }
}
