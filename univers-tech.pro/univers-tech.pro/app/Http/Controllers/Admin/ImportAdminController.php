<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ImportUploadRequest;
use App\Services\ImportService;
use App\Support\ActivityLogger;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ImportAdminController extends Controller
{
    public function __construct(private ImportService $imports)
    {
    }

    public function studentsTemplate(): StreamedResponse
    {
        return $this->template(ImportService::TYPE_STUDENTS);
    }

    public function studentsPreview(ImportUploadRequest $request)
    {
        return $this->preview(ImportService::TYPE_STUDENTS, $request);
    }

    public function studentsApply(ImportUploadRequest $request)
    {
        return $this->apply(ImportService::TYPE_STUDENTS, $request);
    }

    public function coursesTemplate(): StreamedResponse
    {
        return $this->template(ImportService::TYPE_COURSES);
    }

    public function coursesPreview(ImportUploadRequest $request)
    {
        return $this->preview(ImportService::TYPE_COURSES, $request);
    }

    public function coursesApply(ImportUploadRequest $request)
    {
        return $this->apply(ImportService::TYPE_COURSES, $request);
    }

    private function template(string $type): StreamedResponse
    {
        $content = $this->imports->template($type);

        return response()->streamDownload(function () use ($content) {
            echo $content;
        }, 'import-' . $type . '-template.csv', ['Content-Type' => 'text/csv']);
    }

    private function preview(string $type, ImportUploadRequest $request)
    {
        $parsed = $this->imports->parse($request->file('file'), $type);

        if ($parsed['missing'] !== []) {
            return SendResponse(422, 'The file headers do not match the template.', [
                'missing_columns' => $parsed['missing'],
            ]);
        }

        if (count($parsed['rows']) > ImportService::MAX_ROWS) {
            return SendResponse(422, 'The file contains more than ' . ImportService::MAX_ROWS . ' rows.');
        }

        $preview = $this->imports->preview($type, $parsed['rows']);

        return SendResponse(200, 'Preview generated successfully.', [
            'rows' => $preview['rows'],
            'summary' => $preview['summary'],
        ]);
    }

    private function apply(string $type, ImportUploadRequest $request)
    {
        $parsed = $this->imports->parse($request->file('file'), $type);

        if ($parsed['missing'] !== []) {
            return SendResponse(422, 'The file headers do not match the template.', [
                'missing_columns' => $parsed['missing'],
            ]);
        }

        if (count($parsed['rows']) > ImportService::MAX_ROWS) {
            return SendResponse(422, 'The file contains more than ' . ImportService::MAX_ROWS . ' rows.');
        }

        $result = $this->imports->apply($type, $parsed['rows'], $request->user());

        // Audit only the summary and the failing line numbers; row contents may
        // contain personal data and are never written to the log.
        ActivityLogger::log(
            ActivityLogger::DATA_IMPORTED,
            null,
            [
                'type' => $type,
                'imported' => $result['imported'],
                'skipped' => $result['skipped'],
                'failed_rows' => array_column($result['errors'], 'row'),
            ],
            $request->user(),
            'Imported ' . $result['imported'] . ' ' . $type . ' row(s); skipped ' . $result['skipped'] . '.'
        );

        return SendResponse(200, 'Import completed successfully.', $result);
    }
}
