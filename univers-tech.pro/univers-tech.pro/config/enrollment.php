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

];
