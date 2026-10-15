<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Enrollment policy defaults
    |--------------------------------------------------------------------------
    |
    | Default values for the enrollment settings in §0.7. Each key here is
    | overridable at runtime by an admin through the `settings` table, so the
    | numbers below are only the fallbacks used when a setting has not been
    | changed yet. All of these are assumptions for the owner to confirm.
    |
    */

    // Maximum credit hours a student may register for in a single semester.
    'credit_limit' => 18,

    // Minimum percentage needed for a prerequisite grade to be considered
    // "passed" (50 marks out of 100 => passing).
    'passing_score' => 50,

    // Days after the registration window closes within which a student may
    // drop a course (withdrawal window).
    'drop_window_days' => 14,

    // Hours after publication during which a professor may still edit a
    // published grade (with a required reason). After this, only an admin may
    // change the grade.
    'grade_edit_window_hours' => 48,

    // Hours after an attendance record is created during which a professor may
    // still correct their own attendance record. After this, only an admin may
    // change it.
    'attendance_edit_window_hours' => 48,

    // Absence percentage per course at which the student gets a warning
    // notification (sent once per course per threshold).
    'attendance_warn_threshold' => 15,

    // Absence percentage per course at which the student is flagged as
    // "exam barred" (informational for now, does not block grades).
    'attendance_bar_threshold' => 25,

    // Days after publication during which a student may appeal a grade.
    'appeal_window_days' => 14,

];
