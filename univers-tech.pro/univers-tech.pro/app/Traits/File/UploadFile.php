<?php

namespace App\Traits\File;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

trait UploadFile
{
    public function uploadFile(Request $request, string $key, string $folder): string
    {
        $file = $request->file($key);
        $hashName = \Illuminate\Support\Str::uuid() . '.' . $file->extension();

        return $file->storeAs($folder, $hashName, 'files');
    }
}