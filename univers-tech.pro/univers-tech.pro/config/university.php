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

];
