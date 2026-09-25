<?php

namespace App\Traits\File;

use Illuminate\Support\Facades\Storage;

trait DeleteFile
{
    public function deleteFile(string $path): void
    {
        Storage::disk('files')->delete($path);
    }
}