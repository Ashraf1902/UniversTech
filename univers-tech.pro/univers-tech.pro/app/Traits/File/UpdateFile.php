<?php

namespace App\Traits\File;

trait UpdateFile
{
    use DeleteFile, UploadFile;

    public function updateFile(string $oldPath, $request, string $key, string $folder): string
    {
        $this->deleteFile($oldPath);

        return $this->uploadFile($request, $key, $folder);
    }
}