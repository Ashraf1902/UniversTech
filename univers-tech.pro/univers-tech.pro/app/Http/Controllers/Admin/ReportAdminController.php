<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Payment;
use App\Models\StudentCourse;
use App\Support\ActivityLogger;
use App\Support\Settings;
use Illuminate\Contracts\Database\Query\Builder as BuilderContract;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Read-only reporting (A8): enrollment, payments collected and attendance.
 *
 * Every figure is aggregated in SQL (group by / case-sum) so a report never
 * loads the underlying rows into memory, and soft-deleted courses, users and
 * attendance rows are excluded at the query level.
 */
class ReportAdminController extends Controller
{
    public function enrollment(Request $request)
    {
        $this->validateFilters($request, ['semester_id', 'department_id', 'level_id']);

        $report = $this->enrollmentReport($request);

        if ($this->wantsCsv($request)) {
            return $this->streamCsv('enrollment-report', $report['rows'], function (array $row) {
                return [
                    $row['course_name'],
                    $row['course_code'],
                    $row['department'],
                    $row['capacity'],
                    $row['registered'],
                    $row['dropped'],
                    $row['completed'],
                    $row['failed'],
                    $row['total'],
                    $row['capacity_usage'],
                ];
            }, ['Course', 'Code', 'Department', 'Capacity', 'Registered', 'Dropped', 'Completed', 'Failed', 'Total', 'Capacity Usage %'], $request);
        }

        return SendResponse(200, 'Enrollment report generated successfully.', $report);
    }

    public function payments(Request $request)
    {
        $this->validateFilters($request, ['semester_id', 'department_id', 'level_id', 'date_from', 'date_to']);

        $report = $this->paymentsReport($request);

        if ($this->wantsCsv($request)) {
            return $this->streamCsv('payments-report', $report['by_period'], function (array $row) {
                return [$row['period'], $row['count'], $row['total'], $row['collected']];
            }, ['Period', 'Payments', 'Total', 'Collected'], $request);
        }

        return SendResponse(200, 'Payments report generated successfully.', $report);
    }

    public function attendance(Request $request)
    {
        $this->validateFilters($request, ['semester_id', 'department_id', 'level_id', 'course_id']);

        $report = $this->attendanceReport($request);

        if ($this->wantsCsv($request)) {
            return $this->streamCsv('attendance-report', $report['rows'], function (array $row) {
                return [
                    $row['course_name'],
                    $row['course_code'],
                    $row['sessions'],
                    $row['records'],
                    $row['present'],
                    $row['absent'],
                    $row['absence_percentage'],
                ];
            }, ['Course', 'Code', 'Sessions', 'Records', 'Present', 'Absent', 'Absence %'], $request);
        }

        return SendResponse(200, 'Attendance report generated successfully.', $report);
    }

    /**
     * @return array{rows: array<int, array<string, mixed>>, totals: array<string, mixed>}
     */
    private function enrollmentReport(Request $request): array
    {
        $rows = StudentCourse::query()
            ->join('courses', 'courses.id', '=', 'student_courses.course_id')
            ->leftJoin('departments', 'departments.id', '=', 'courses.department_id')
            ->leftJoin('students', 'students.user_id', '=', 'student_courses.student_id')
            ->whereNull('courses.deleted_at')
            ->when($request->filled('semester_id'), fn ($q) => $q->where('student_courses.semester_id', $request->integer('semester_id')))
            ->when($request->filled('department_id'), fn ($q) => $q->where('courses.department_id', $request->integer('department_id')))
            ->when($request->filled('level_id'), fn ($q) => $q->where('students.level_id', $request->integer('level_id')))
            ->selectRaw('courses.id as course_id')
            ->selectRaw('courses.course_name as course_name')
            ->selectRaw('courses.course_code as course_code')
            ->selectRaw('courses.capacity as capacity')
            ->selectRaw('departments.name as department')
            ->selectRaw('count(student_courses.id) as total')
            ->selectRaw("sum(case when student_courses.status = 'registered' then 1 else 0 end) as registered")
            ->selectRaw("sum(case when student_courses.status = 'dropped' then 1 else 0 end) as dropped")
            ->selectRaw("sum(case when student_courses.status = 'completed' then 1 else 0 end) as completed")
            ->selectRaw("sum(case when student_courses.status = 'failed' then 1 else 0 end) as failed")
            ->groupBy('courses.id', 'courses.course_name', 'courses.course_code', 'courses.capacity', 'departments.name')
            ->orderBy('courses.course_name')
            ->get()
            ->map(function ($row) {
                $registered = (int) $row->registered;
                $capacity = $row->capacity === null ? null : (int) $row->capacity;

                return [
                    'course_id' => (int) $row->course_id,
                    'course_name' => $row->course_name,
                    'course_code' => $row->course_code,
                    'department' => $row->department,
                    'capacity' => $capacity,
                    'registered' => $registered,
                    'dropped' => (int) $row->dropped,
                    'completed' => (int) $row->completed,
                    'failed' => (int) $row->failed,
                    'total' => (int) $row->total,
                    'capacity_usage' => $capacity ? round($registered / $capacity * 100, 2) : null,
                ];
            })
            ->all();

        $totals = [
            'courses' => count($rows),
            'capacity' => array_sum(array_map(fn (array $row) => $row['capacity'] ?? 0, $rows)),
            'registered' => array_sum(array_column($rows, 'registered')),
            'dropped' => array_sum(array_column($rows, 'dropped')),
            'completed' => array_sum(array_column($rows, 'completed')),
            'failed' => array_sum(array_column($rows, 'failed')),
            'enrollments' => array_sum(array_column($rows, 'total')),
        ];

        return ['rows' => $rows, 'totals' => $totals];
    }

    /**
     * @return array{
     *     totals: array<string, mixed>,
     *     by_status: array<int, array<string, mixed>>,
     *     by_period: array<int, array<string, mixed>>,
     *     by_department: array<int, array<string, mixed>>
     * }
     */
    private function paymentsReport(Request $request): array
    {
        $effectiveDate = 'coalesce(payments.paid_at, payments.created_at)';
        $month = $this->monthExpression($effectiveDate);

        $totals = $this->paymentsBase($request)
            ->selectRaw('count(*) as count')
            ->selectRaw("coalesce(sum(case when payments.status = 'paid' then payments.amount else 0 end), 0) as collected")
            ->selectRaw("coalesce(sum(case when payments.status = 'pending' then payments.amount else 0 end), 0) as pending")
            ->selectRaw("coalesce(sum(case when payments.status = 'waived' then payments.amount else 0 end), 0) as waived")
            ->selectRaw("coalesce(sum(case when payments.status = 'refunded' then payments.amount else 0 end), 0) as refunded")
            ->first();

        $byStatus = $this->paymentsBase($request)
            ->selectRaw('payments.status as status')
            ->selectRaw('count(*) as count')
            ->selectRaw('coalesce(sum(payments.amount), 0) as total')
            ->groupBy('payments.status')
            ->orderBy('payments.status')
            ->get()
            ->map(fn ($row) => [
                'status' => $row->status,
                'count' => (int) $row->count,
                'total' => round((float) $row->total, 2),
            ])
            ->all();

        $byPeriod = $this->paymentsBase($request)
            ->selectRaw($month . ' as period')
            ->selectRaw('count(*) as count')
            ->selectRaw('coalesce(sum(payments.amount), 0) as total')
            ->selectRaw("coalesce(sum(case when payments.status = 'paid' then payments.amount else 0 end), 0) as collected")
            ->groupBy(DB::raw($month))
            ->orderBy(DB::raw($month))
            ->get()
            ->map(fn ($row) => [
                'period' => $row->period,
                'count' => (int) $row->count,
                'total' => round((float) $row->total, 2),
                'collected' => round((float) $row->collected, 2),
            ])
            ->all();

        $byDepartment = $this->paymentsBase($request)
            ->selectRaw("coalesce(departments.name, 'Unassigned') as department")
            ->selectRaw('count(*) as count')
            ->selectRaw('coalesce(sum(payments.amount), 0) as total')
            ->selectRaw("coalesce(sum(case when payments.status = 'paid' then payments.amount else 0 end), 0) as collected")
            ->groupBy('departments.name')
            ->orderBy('departments.name')
            ->get()
            ->map(fn ($row) => [
                'department' => $row->department,
                'count' => (int) $row->count,
                'total' => round((float) $row->total, 2),
                'collected' => round((float) $row->collected, 2),
            ])
            ->all();

        return [
            'totals' => [
                'count' => (int) $totals->count,
                'collected' => round((float) $totals->collected, 2),
                'pending' => round((float) $totals->pending, 2),
                'waived' => round((float) $totals->waived, 2),
                'refunded' => round((float) $totals->refunded, 2),
            ],
            'by_status' => $byStatus,
            'by_period' => $byPeriod,
            'by_department' => $byDepartment,
        ];
    }

    /**
     * @return array{
     *     rows: array<int, array<string, mixed>>,
     *     levels: array<int, array<string, mixed>>,
     *     students_over_threshold: array<int, array<string, mixed>>,
     *     totals: array<string, mixed>,
     *     thresholds: array<string, int>
     * }
     */
    private function attendanceReport(Request $request): array
    {
        $warn = Settings::attendanceWarnThreshold();
        $bar = Settings::attendanceBarThreshold();

        $rows = $this->attendanceBase($request)
            ->selectRaw('courses.id as course_id')
            ->selectRaw('courses.course_name as course_name')
            ->selectRaw('courses.course_code as course_code')
            ->selectRaw('count(attendances.id) as records')
            ->selectRaw('count(distinct attendances.date) as sessions')
            ->selectRaw('sum(case when attendances.status = 1 then 1 else 0 end) as present')
            ->selectRaw('sum(case when attendances.status = 0 then 1 else 0 end) as absent')
            ->groupBy('courses.id', 'courses.course_name', 'courses.course_code')
            ->orderBy('courses.course_name')
            ->get()
            ->map(function ($row) {
                $records = (int) $row->records;
                $absent = (int) $row->absent;

                return [
                    'course_id' => (int) $row->course_id,
                    'course_name' => $row->course_name,
                    'course_code' => $row->course_code,
                    'sessions' => (int) $row->sessions,
                    'records' => $records,
                    'present' => (int) $row->present,
                    'absent' => $absent,
                    'absence_percentage' => $records > 0 ? round($absent / $records * 100, 2) : 0.0,
                ];
            })
            ->all();

        $levels = $this->attendanceBase($request)
            ->selectRaw("coalesce(levels.name, 'Unassigned') as level")
            ->selectRaw('count(attendances.id) as records')
            ->selectRaw('sum(case when attendances.status = 0 then 1 else 0 end) as absent')
            ->groupBy('levels.name')
            ->orderBy('levels.name')
            ->get()
            ->map(function ($row) {
                $records = (int) $row->records;
                $absent = (int) $row->absent;

                return [
                    'level' => $row->level,
                    'records' => $records,
                    'absent' => $absent,
                    'absence_percentage' => $records > 0 ? round($absent / $records * 100, 2) : 0.0,
                ];
            })
            ->all();

        $rate = '(sum(case when attendances.status = 0 then 1 else 0 end) * 100.0 / count(attendances.id))';

        $studentsOver = $this->attendanceBase($request)
            ->selectRaw('attendances.student_id as student_id')
            ->selectRaw('users.name as student_name')
            ->selectRaw('courses.course_name as course_name')
            ->selectRaw('courses.course_code as course_code')
            ->selectRaw('count(attendances.id) as records')
            ->selectRaw('sum(case when attendances.status = 1 then 1 else 0 end) as present')
            ->selectRaw('sum(case when attendances.status = 0 then 1 else 0 end) as absent')
            ->selectRaw($rate . ' as absence_percentage')
            ->groupBy('attendances.student_id', 'users.name', 'courses.id', 'courses.course_name', 'courses.course_code')
            ->havingRaw($rate . ' >= ?', [$warn])
            ->orderByRaw($rate . ' desc')
            ->get()
            ->map(function ($row) use ($bar) {
                $percentage = round((float) $row->absence_percentage, 2);

                return [
                    'student_id' => (int) $row->student_id,
                    'student_name' => $row->student_name,
                    'course_name' => $row->course_name,
                    'course_code' => $row->course_code,
                    'records' => (int) $row->records,
                    'present' => (int) $row->present,
                    'absent' => (int) $row->absent,
                    'absence_percentage' => $percentage,
                    'status' => $percentage >= $bar ? 'barred' : 'warning',
                ];
            })
            ->all();

        $records = array_sum(array_column($rows, 'records'));
        $absent = array_sum(array_column($rows, 'absent'));

        return [
            'rows' => $rows,
            'levels' => $levels,
            'students_over_threshold' => $studentsOver,
            'totals' => [
                'courses' => count($rows),
                'records' => $records,
                'present' => array_sum(array_column($rows, 'present')),
                'absent' => $absent,
                'absence_percentage' => $records > 0 ? round($absent / $records * 100, 2) : 0.0,
            ],
            'thresholds' => ['warn' => $warn, 'bar' => $bar],
        ];
    }

    private function paymentsBase(Request $request): BuilderContract
    {
        return Payment::query()
            ->join('users', 'users.id', '=', 'payments.user_id')
            ->leftJoin('students', 'students.user_id', '=', 'payments.user_id')
            ->leftJoin('departments', 'departments.id', '=', 'students.department_id')
            ->whereNull('users.deleted_at')
            ->when($request->filled('semester_id'), fn ($q) => $q->where('payments.semester_id', $request->integer('semester_id')))
            ->when($request->filled('department_id'), fn ($q) => $q->where('students.department_id', $request->integer('department_id')))
            ->when($request->filled('level_id'), fn ($q) => $q->where('students.level_id', $request->integer('level_id')))
            ->when($request->filled('date_from'), fn ($q) => $q->whereRaw('coalesce(payments.paid_at, payments.created_at) >= ?', [$request->input('date_from')]))
            ->when($request->filled('date_to'), fn ($q) => $q->whereRaw('coalesce(payments.paid_at, payments.created_at) <= ?', [$request->input('date_to') . ' 23:59:59']));
    }

    private function attendanceBase(Request $request): BuilderContract
    {
        return Attendance::query()
            ->join('courses', 'courses.id', '=', 'attendances.course_id')
            ->join('users', 'users.id', '=', 'attendances.student_id')
            ->leftJoin('students', 'students.user_id', '=', 'attendances.student_id')
            ->leftJoin('levels', 'levels.id', '=', 'students.level_id')
            ->whereNull('courses.deleted_at')
            ->whereNull('users.deleted_at')
            ->when($request->filled('semester_id'), fn ($q) => $q->where('courses.semester_id', $request->integer('semester_id')))
            ->when($request->filled('department_id'), fn ($q) => $q->where('courses.department_id', $request->integer('department_id')))
            ->when($request->filled('level_id'), fn ($q) => $q->where('students.level_id', $request->integer('level_id')))
            ->when($request->filled('course_id'), fn ($q) => $q->where('attendances.course_id', $request->integer('course_id')));
    }

    private function monthExpression(string $column): string
    {
        return DB::connection()->getDriverName() === 'sqlite'
            ? "strftime('%Y-%m', {$column})"
            : "DATE_FORMAT({$column}, '%Y-%m')";
    }

    /**
     * @param  array<int, string>  $keys
     */
    private function validateFilters(Request $request, array $keys): void
    {
        $rules = [];

        foreach ($keys as $key) {
            $rules[$key] = match ($key) {
                'date_from', 'date_to' => 'nullable|date',
                'semester_id' => 'nullable|integer|exists:semesters,id',
                'department_id' => 'nullable|integer|exists:departments,id',
                'level_id' => 'nullable|integer|exists:levels,id',
                'course_id' => 'nullable|integer|exists:courses,id',
                default => 'nullable',
            };
        }

        $request->validate($rules);
    }

    private function wantsCsv(Request $request): bool
    {
        return in_array(strtolower((string) $request->input('export')), ['csv', '1', 'true'], true);
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     * @param  callable(array<string, mixed>): array<int, mixed>  $map
     * @param  array<int, string>  $headers
     */
    private function streamCsv(string $filename, array $rows, callable $map, array $headers, Request $request): StreamedResponse
    {
        ActivityLogger::log(
            ActivityLogger::REPORT_EXPORTED,
            null,
            [
                'report' => $filename,
                'filters' => array_filter([
                    'semester_id' => $request->integer('semester_id') ?: null,
                    'department_id' => $request->integer('department_id') ?: null,
                    'level_id' => $request->integer('level_id') ?: null,
                    'course_id' => $request->integer('course_id') ?: null,
                    'date_from' => $request->input('date_from'),
                    'date_to' => $request->input('date_to'),
                ]),
                'rows' => count($rows),
            ],
            $request->user(),
            'Exported the ' . $filename . '.'
        );

        return response()->streamDownload(function () use ($rows, $map, $headers) {
            $out = fopen('php://output', 'w');
            fputcsv($out, $headers);

            foreach ($rows as $row) {
                fputcsv($out, $map($row));
            }

            fclose($out);
        }, $filename . '-' . now()->format('Y-m-d') . '.csv', ['Content-Type' => 'text/csv']);
    }
}
