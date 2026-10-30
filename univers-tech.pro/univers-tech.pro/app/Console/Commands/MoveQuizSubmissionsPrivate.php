<?php

namespace App\Console\Commands;

use App\Models\QuizSubmission;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Move legacy quiz-submission files from the public uploads disk to the
 * private disk and repoint the database at the new location.
 *
 * Safe by default: --dry-run is the default behaviour, so the command only
 * reports what it would do. Pass --apply to perform the moves and
 * --purge-public to delete the public copies after each row is verified.
 */
class MoveQuizSubmissionsPrivate extends Command
{
    protected $signature = 'files:move-private
        {--dry-run : Only report what would happen (default)}
        {--apply : Actually move files and update the database}
        {--purge-public : After a verified move, delete the public copy}';

    protected $description = 'Move quiz submissions from the public uploads disk to the private disk.';

    public function handle(): int
    {
        $apply = (bool) $this->option('apply') && ! $this->option('dry-run');
        $purge = (bool) $this->option('purge-public');

        if ($purge && ! $apply) {
            $this->warn('--purge-public requires --apply; nothing will be deleted in a dry run.');
        }

        $stats = [
            'found' => 0,
            'moved' => 0,
            'already' => 0,
            'missing' => 0,
            'purged' => 0,
            'errors' => 0,
        ];

        QuizSubmission::query()
            ->whereNotNull('file')
            ->where('file', '!=', '')
            ->orderBy('id')
            ->chunkById(100, function ($submissions) use ($apply, $purge, &$stats) {
                foreach ($submissions as $submission) {
                    $stats['found']++;

                    try {
                        $this->process($submission, $apply, $purge, $stats);
                    } catch (Throwable $e) {
                        $stats['errors']++;
                        $this->error("  #{$submission->id}: {$e->getMessage()}");
                    }
                }
            });

        $this->newLine();
        $this->table(
            ['Found', 'Moved', 'Already private', 'Missing', 'Public purged', 'Errors'],
            [[
                $stats['found'],
                $stats['moved'],
                $stats['already'],
                $stats['missing'],
                $stats['purged'],
                $stats['errors'],
            ]]
        );

        if (! $apply) {
            $this->info('Dry run only: no files or database rows were changed. Re-run with --apply to move.');
        }

        return $stats['errors'] > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * @param  array<string, int>  $stats
     */
    private function process(QuizSubmission $submission, bool $apply, bool $purge, array &$stats): void
    {
        $source = (string) $submission->file;

        if (str_starts_with($source, 'quiz-submissions/')) {
            $stats['already']++;

            return;
        }

        $public = Storage::disk('files');
        $private = Storage::disk('private');

        if (! $this->isSafeRelativePath($source) || ! $public->exists($source)) {
            $stats['missing']++;
            $this->line("  #{$submission->id}: missing public file ({$source})");

            return;
        }

        $basename = basename(str_replace('\\', '/', $source));
        $target = 'quiz-submissions/' . $submission->quiz_id . '/' . $basename;

        if (! $apply) {
            $this->line("  #{$submission->id}: would move {$source} -> {$target}" . ($purge ? ' and purge public' : ''));

            return;
        }

        $sourceSize = (int) $public->size($source);

        if ($private->exists($target) && (int) $private->size($target) !== $sourceSize) {
            throw new \RuntimeException("target already exists with a different size: {$target}");
        }

        if (! $private->exists($target)) {
            $stream = $public->readStream($source);

            if ($stream === false) {
                throw new \RuntimeException("cannot read source: {$source}");
            }

            try {
                $private->writeStream($target, $stream);
            } finally {
                if (is_resource($stream)) {
                    fclose($stream);
                }
            }
        }

        if (! $private->exists($target) || (int) $private->size($target) !== $sourceSize) {
            $private->delete($target);
            throw new \RuntimeException("verification failed for {$target}");
        }

        try {
            DB::transaction(function () use ($submission, $target) {
                $submission->forceFill(['file' => $target])->save();
            });
        } catch (Throwable $e) {
            $private->delete($target);
            throw $e;
        }

        $stats['moved']++;

        if ($purge) {
            if ($public->delete($source)) {
                $stats['purged']++;
            } else {
                $this->warn("  #{$submission->id}: moved, but deleting the public copy failed ({$source})");
            }
        }
    }

    private function isSafeRelativePath(string $path): bool
    {
        return $path !== ''
            && ! str_contains($path, "\0")
            && ! str_contains($path, '\\')
            && ! str_starts_with($path, '/')
            && ! in_array('..', explode('/', $path), true)
            && ! str_starts_with($path, 'quiz-submissions/');
    }
}
