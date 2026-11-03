<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The backend serves an API only: there is no login page to redirect to. Any
 * unauthenticated call to an /api/* route must come back as the normal JSON
 * envelope with a 401, whatever the client claims to accept.
 */
class ApiUnauthenticatedJsonTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Protected API routes across all three guards and both prefixes.
     *
     * @return array<int, array{0: string}>
     */
    public static function protectedRoutes(): array
    {
        return [
            ['/api/user'],
            ['/api/user/quizzes'],
            ['/api/user/reports'],
            ['/api/admin/profile'],
            ['/api/quiz/get/all/1'],
        ];
    }

    /**
     * @return array<int, array{0: string, 1: array<string, string>}>
     */
    public static function acceptHeaders(): array
    {
        return [
            'no Accept header' => [[ ]],
            'browser Accept header' => [['Accept' => 'text/html,application/xhtml+xml']],
            'JSON Accept header' => [['Accept' => 'application/json']],
        ];
    }

    /**
     * @param  string  $uri
     */
    #[DataProvider('protectedRoutes')]
    public function test_unauthenticated_api_requests_always_get_json_401(string $uri): void
    {
        foreach (self::acceptHeaders() as $label => [$headers]) {
            $response = $this->withHeaders($headers)->get($uri);

            $response->assertStatus(401);
            $response->assertHeaderMissing('Location');
            $this->assertStringContainsString(
                'application/json',
                (string) $response->headers->get('Content-Type'),
                "{$uri} ({$label}) should answer with JSON."
            );

            $response->assertJson([
                'status' => 401,
                'message' => 'Unauthenticated.',
                'data' => null,
            ]);
        }
    }
}
