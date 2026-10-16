<?php

namespace App\Http\Requests\Admin;

use App\Services\ImportService;
use App\Traits\FetchRequestError;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ImportUploadRequest extends FormRequest
{
    use FetchRequestError;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:' . ImportService::MAX_FILE_KB],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $file = $this->file('file');

                if ($file === null) {
                    return;
                }

                $extension = strtolower((string) $file->getClientOriginalExtension());

                if (! in_array($extension, ['csv', 'txt'], true)) {
                    $validator->errors()->add('file', 'The file must be a CSV file.');
                }
            },
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'file.max' => 'The file must not be larger than ' . ImportService::MAX_FILE_KB . ' KB.',
        ];
    }
}
