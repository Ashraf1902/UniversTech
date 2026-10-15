<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Schedule;
use App\Support\ScheduleOverlap;

/**
 * Detects schedule conflicts (A3).
 *
 * Room and professor overlaps are blocking; a same level+department overlap is
 * returned as a non-blocking warning. All time comparisons go through the same
 * {@see ScheduleOverlap} helper used by student registration (S1), so the two
 * features can never disagree.
 */
class ScheduleService
{
    /**
     * Conflicts for a candidate schedule.
     *
     * @param  array<string, mixed>  $data
     * @return array{conflicts: array<int, array<string, mixed>>, warnings: array<int, array<string, mixed>>}
     */
    public function checkConflicts(array $data, ?int $ignoreId = null): array
    {
        $semesterId = $data['semester_id'] ?? null;
        $day = $data['day_of_week'] ?? null;
        $roomId = $data['room_id'] ?? null;
        $levelId = $data['level_id'] ?? null;
        $departmentId = $data['department_id'] ?? null;
        $courseId = $data['course_id'] ?? null;

        $professorId = $courseId ? Course::whereKey($courseId)->value('professor_id') : null;

        if (! $semesterId || ! $day || ! ($data['start_time'] ?? null) || ! ($data['end_time'] ?? null)) {
            return ['conflicts' => [], 'warnings' => []];
        }

        $candidate = [
            'day_of_week' => $day,
            'start_time' => $data['start_time'],
            'end_time' => $data['end_time'],
        ];

        $existing = Schedule::with(['course:id,course_name,professor_id', 'room:id,name'])
            ->where('semester_id', $semesterId)
            ->where('day_of_week', $day)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->get();

        $conflicts = [];
        $warnings = [];

        foreach ($existing as $row) {
            if ((string) $row->day_of_week !== (string) $day) {
                continue;
            }

            if (! ScheduleOverlap::conflicts($candidate, $this->slot($row))) {
                continue;
            }

            if ($roomId && $row->room_id && (int) $row->room_id === (int) $roomId) {
                $conflicts[] = $this->describe($row, 'room');
            }

            if ($professorId && $row->course?->professor_id && (int) $row->course->professor_id === (int) $professorId) {
                $conflicts[] = $this->describe($row, 'professor');
            }

            if ($levelId && (int) $row->level_id === (int) $levelId
                && (int) ($row->department_id ?? 0) === (int) ($departmentId ?? 0)) {
                $warnings[] = $this->describe($row, 'level_department');
            }
        }

        return ['conflicts' => $conflicts, 'warnings' => $warnings];
    }

    /**
     * A report of conflicts already present in stored data. Nothing is fixed.
     *
     * @return array<int, array<string, mixed>>
     */
    public function existingConflicts(): array
    {
        $schedules = Schedule::with(['course:id,course_name,professor_id', 'room:id,name'])
            ->whereNotNull('semester_id')
            ->whereNotNull('day_of_week')
            ->orderBy('semester_id')
            ->orderBy('day_of_week')
            ->orderBy('start_time')
            ->get();

        $results = [];

        foreach ($schedules->groupBy(fn (Schedule $row) => $row->semester_id . '|' . $row->day_of_week) as $rows) {
            $rows = $rows->values();

            for ($i = 0; $i < $rows->count(); $i++) {
                for ($j = $i + 1; $j < $rows->count(); $j++) {
                    $a = $rows[$i];
                    $b = $rows[$j];

                    if (! ScheduleOverlap::conflicts($this->slot($a), $this->slot($b))) {
                        continue;
                    }

                    if ($a->room_id && $b->room_id && (int) $a->room_id === (int) $b->room_id) {
                        $results[] = [
                            'type' => 'room',
                            'a' => $this->describe($a, 'room'),
                            'b' => $this->describe($b, 'room'),
                        ];
                    }

                    if ($a->course?->professor_id && $b->course?->professor_id
                        && (int) $a->course->professor_id === (int) $b->course->professor_id) {
                        $results[] = [
                            'type' => 'professor',
                            'a' => $this->describe($a, 'professor'),
                            'b' => $this->describe($b, 'professor'),
                        ];
                    }
                }
            }
        }

        return $results;
    }

    /**
     * @return array{day_of_week: mixed, start_time: mixed, end_time: mixed}
     */
    private function slot(Schedule $row): array
    {
        return [
            'day_of_week' => $row->day_of_week,
            'start_time' => $row->start_time,
            'end_time' => $row->end_time,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function describe(Schedule $row, string $type): array
    {
        return [
            'id' => $row->id,
            'type' => $type,
            'course_name' => $row->course?->course_name,
            'day_of_week' => $row->day_of_week,
            'start_time' => $row->start_time?->format('H:i'),
            'end_time' => $row->end_time?->format('H:i'),
            'room' => $row->room?->name,
            'level_id' => $row->level_id,
            'department_id' => $row->department_id,
        ];
    }
}
