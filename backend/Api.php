<?php
declare(strict_types=1);
require_once __DIR__ . '/Storage.php';
require_once __DIR__ . '/Validation.php';

final class Api
{
    public function __construct(private Storage $storage) {}

    private function response(array $data, int $status = 200, array $headers = []): array
    {
        return ['status' => $status, 'headers' => array_merge(['Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store'], $headers), 'body' => json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES)];
    }

    private function authenticated(string $token): bool
    {
        if (!preg_match('/^[a-f0-9]{64}$/D', $token)) return false;
        $session = read_record($this->storage, 'sessions/' . hash('sha256', $token));
        return $session !== null && ($session['expires'] ?? 0) > time() * 1000;
    }

    private function cookie(string $token, int $age, bool $secure): string
    {
        return 'portfolio_session=' . $token . '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' . $age . ($secure ? '; Secure' : '');
    }

    public function handle(array $request): array
    {
        $path = $request['path'];
        $method = $request['method'];
        $token = $request['token'] ?? '';
        $secure = $request['secure'] ?? true;
        if ($method !== 'GET' && ($request['origin'] ?? '') !== $request['expectedOrigin']) return $this->response(['error' => 'Invalid request origin.'], 403);
        if ($path === '/api/content' && $method === 'GET') {
            return $this->response(read_record($this->storage, 'content') ?? json_decode(file_get_contents(__DIR__ . '/default-content.json'), true, 512, JSON_THROW_ON_ERROR));
        }
        if ($path === '/api/status' && $method === 'GET') return $this->response(['initialized' => read_record($this->storage, 'auth') !== null, 'authenticated' => $this->authenticated($token), 'canSetup' => false]);
        if ($path === '/api/login' && $method === 'POST') {
            $body = $this->parseBody($request['body'] ?? '');
            if ($body === null) return $this->response(['error' => 'Invalid JSON.'], 400);
            $password = $body['password'] ?? null;
            if (!is_string($password) || strlen($password) > 1024) return $this->response(['error' => 'Incorrect password.'], 401);
            $key = 'limits/' . hash('sha256', $request['ip'] ?? 'unknown');
            $now = time() * 1000;
            $limit = read_record($this->storage, $key) ?? ['count' => 0, 'until' => 0];
            if ($limit['until'] > $now && $limit['count'] >= 8) return $this->response(['error' => 'Too many attempts. Try again in 15 minutes.'], 429);
            $auth = read_record($this->storage, 'auth');
            if ($auth === null) return $this->response(['error' => 'Admin has not been initialized.'], 503);
            // Accept existing Node.js PBKDF2 records once, then upgrade to PHP hashing.
            $legacy = !isset($auth['passwordHash']) && isset($auth['salt'], $auth['digest']);
            $valid = $legacy ? hash_equals($auth['digest'], hash_pbkdf2('sha256', $password, $auth['salt'], 100000, 64)) : (strlen($password) <= 72 && password_verify($password, $auth['passwordHash'] ?? ''));
            if (!$valid) {
                write_record($this->storage, $key, ['count' => $limit['until'] > $now ? $limit['count'] + 1 : 1, 'until' => $now + 900000]);
                return $this->response(['error' => 'Incorrect password.'], 401);
            }
            if (($legacy || password_needs_rehash($auth['passwordHash'], PASSWORD_DEFAULT)) && strlen($password) <= 72) write_record($this->storage, 'auth', ['passwordHash' => password_hash($password, PASSWORD_DEFAULT)]);
            write_record($this->storage, $key, ['count' => 0, 'until' => 0]);
            $newToken = bin2hex(random_bytes(32));
            write_record($this->storage, 'sessions/' . hash('sha256', $newToken), ['expires' => $now + 28800000]);
            return $this->response(['ok' => true], 200, ['Set-Cookie' => $this->cookie($newToken, 28800, $secure)]);
        }
        if (!$this->authenticated($token)) return $this->response(['error' => 'Please sign in.'], 401);
        if ($path === '/api/logout' && $method === 'POST') {
            $this->storage->delete('sessions/' . hash('sha256', $token));
            return $this->response(['ok' => true], 200, ['Set-Cookie' => $this->cookie('', 0, $secure)]);
        }
        if ($path === '/api/content' && $method === 'PUT') {
            if (strlen($request['body'] ?? '') > 500000) return $this->response(['error' => 'Content is too large.'], 413);
            $content = $this->parseBody($request['body'] ?? '');
            if ($content === null || !valid_content($content)) return $this->response(['error' => 'Please check the content and links.'], 400);
            write_record($this->storage, 'content', $content);
            return $this->response(['ok' => true]);
        }
        if ($path === '/api/upload' && $method === 'POST') {
            if (in_array($request['uploadError'] ?? UPLOAD_ERR_OK, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) return $this->response(['error' => 'Maximum image size is 10 MB.'], 413);
            $data = $request['image'] ?? null;
            if (!is_string($data) || $data === '') return $this->response(['error' => 'Choose an image file.'], 400);
            if (strlen($data) > 10 * 1024 * 1024) return $this->response(['error' => 'Maximum image size is 10 MB.'], 413);
            $type = image_type($data);
            if ($type === null) return $this->response(['error' => 'Choose a valid PNG, JPEG, or WebP image.'], 400);
            $key = 'images/' . bin2hex(random_bytes(16));
            $this->storage->put($key, $data, ['contentType' => $type]);
            return $this->response(['url' => '/media/' . $key]);
        }
        return $this->response(['error' => 'Not found.'], 404);
    }

    private function parseBody(string $body): ?array
    {
        try { $value = json_decode($body, true, 512, JSON_THROW_ON_ERROR); return is_array($value) ? $value : null; }
        catch (JsonException) { return null; }
    }
}
