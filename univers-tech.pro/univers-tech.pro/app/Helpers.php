<?php

if (! function_exists('SendResponse')) {
    function SendResponse($status, $message, $data = null)
    {
        $response = [
            'status' => $status,
            'message' => $message,
            'data' => $data,
        ];

        return response()->json($response, $status);
    }
}