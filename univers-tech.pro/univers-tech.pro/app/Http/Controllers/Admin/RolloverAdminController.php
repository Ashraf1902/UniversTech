<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Semester;
use App\Services\RolloverService;
use Illuminate\Http\Request;

class RolloverAdminController extends Controller
{
    public function __construct(private RolloverService $rollover)
    {
    }

    public function closePreview(Request $request)
    {
        $data = $request->validate([
            'semester_id' => 'required|exists:semesters,id',
        ]);

        $semester = Semester::findOrFail($data['semester_id']);
        $summary = $this->rollover->closeSummary($semester);

        return SendResponse(200, 'Close preview fetched successfully.', $summary);
    }

    public function close(Request $request)
    {
        $data = $request->validate([
            'semester_id' => 'required|exists:semesters,id',
        ]);

        $semester = Semester::findOrFail($data['semester_id']);
        $result = $this->rollover->close($semester, $request->user());

        return SendResponse(200, 'Semester closed successfully.', $result);
    }

    public function promotionPreview(Request $request)
    {
        $data = $request->validate([
            'from_semester_id' => 'required|exists:semesters,id',
            'student_ids' => 'nullable|array',
            'student_ids.*' => 'exists:users,id',
            'level_ids' => 'nullable|array',
            'level_ids.*' => 'exists:levels,id',
            'exclude' => 'nullable|array',
            'exclude.*' => 'exists:users,id',
            'graduate_final' => 'nullable|boolean',
        ]);

        $list = $this->rollover->previewPromotion($data);

        return SendResponse(200, 'Promotion preview fetched successfully.', $list);
    }

    public function promotionApply(Request $request)
    {
        $data = $request->validate([
            'from_semester_id' => 'required|exists:semesters,id',
            'student_ids' => 'nullable|array',
            'student_ids.*' => 'exists:users,id',
            'level_ids' => 'nullable|array',
            'level_ids.*' => 'exists:levels,id',
            'exclude' => 'nullable|array',
            'exclude.*' => 'exists:users,id',
            'graduate_final' => 'nullable|boolean',
        ]);

        $list = $this->rollover->applyPromotion($data, $request->user());

        return SendResponse(200, 'Promotion applied successfully.', $list);
    }

    public function unresolved(Request $request)
    {
        $data = $request->validate([
            'semester_id' => 'required|exists:semesters,id',
        ]);

        $semester = Semester::findOrFail($data['semester_id']);
        $items = $this->rollover->unresolvedList($semester);

        return SendResponse(200, 'Unresolved enrollments fetched successfully.', $items);
    }
}
