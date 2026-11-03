<?php

return [

    /*
    |--------------------------------------------------------------------------
    | University locale / campus settings
    |--------------------------------------------------------------------------
    |
    | The university's wall-clock timezone. The application itself runs in UTC
    | (config/app.php), but timetable times are the campus's local time, so the
    | API formats them in this timezone and exposes it through /api/public/meta
    | so the UI never has to hardcode it.
    |
    */

    'timezone' => env('UNIVERSITY_TIMEZONE', 'Africa/Cairo'),

    /*
    |--------------------------------------------------------------------------
    | Academic year
    |--------------------------------------------------------------------------
    |
    | The month (1-12) the academic year starts. A courses payment counts for
    | the academic year its paid date falls into: from the 1st of this month
    | to the day before the same month next year, in the campus timezone above.
    |
    */

    'academic_year_start_month' => (int) env('UNIVERSITY_ACADEMIC_YEAR_START_MONTH', 9),

];
