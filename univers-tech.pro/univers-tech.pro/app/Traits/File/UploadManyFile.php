<?php

namespace App\Traits\File;

use Illuminate\Http\Request;

trait UploadManyFile
{
    /**
     * @return array<int, string>
     */
    public function uploadManyFile(Request $request, string $key, string $folder): array
    {
        $paths = [];

        foreach ($request->file($key) as $file) {
            $hashName = \Illuminate\Support\Str::uuid() . '.' . $file->extension();
            $paths[] = $file->storeAs($folder, $hashName, 'files');
        }

        return $paths;
    }
}