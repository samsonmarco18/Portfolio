<?php
declare(strict_types=1);
require_once __DIR__ . '/../backend/Api.php';

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Content-Security-Policy: default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; connect-src \'self\'; object-src \'none\'; base-uri \'self\'; frame-ancestors \'self\'');
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($path === '/' || $path === '/my-admin' || preg_match('~^/projects/[a-z0-9-]+$~D', $path)) {
        if (!in_array($method, ['GET', 'HEAD'], true)) { http_response_code(405); exit; }
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-cache');
        if ($method !== 'HEAD') readfile(__DIR__ . '/index.html');
        exit;
    }
    if (str_starts_with($path, '/api/')) {
        $origin = rtrim(getenv('PUBLIC_URL') ?: (getenv('RENDER_EXTERNAL_URL') ?: ''), '/');
        if ($origin === '') {
            // Development only; production always uses the configured canonical origin.
            if (getenv('RENDER')) throw new RuntimeException('PUBLIC_URL is required.');
            $host = $_SERVER['HTTP_HOST'] ?? 'localhost:3000';
            if (!preg_match('/^(localhost|127\.0\.0\.1)(:\d+)?$/D', $host)) throw new RuntimeException('Configure PUBLIC_URL.');
            $origin = 'http://' . $host;
        }
        if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 11 * 1024 * 1024) {
            http_response_code(413); header('Content-Type: application/json'); echo '{"error":"Maximum request size is 11 MB."}'; exit;
        }
        $image = null;
        $file = $_FILES['image'] ?? null;
        if (is_array($file) && ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK && is_uploaded_file($file['tmp_name']) && $file['size'] <= 10 * 1024 * 1024) $image = file_get_contents($file['tmp_name']);
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        if (getenv('RENDER') && isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $forwarded = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            $candidate = trim(end($forwarded));
            if (filter_var($candidate, FILTER_VALIDATE_IP)) $ip = $candidate;
        }
        $response = (new Api(PostgresStorage::connect()))->handle([
            'path' => $path, 'method' => $method, 'origin' => $_SERVER['HTTP_ORIGIN'] ?? '', 'expectedOrigin' => $origin,
            'token' => is_string($_COOKIE['portfolio_session'] ?? null) ? $_COOKIE['portfolio_session'] : '', 'secure' => str_starts_with($origin, 'https://'),
            'body' => file_get_contents('php://input', false, null, 0, 500001), 'image' => $image, 'uploadError' => $file['error'] ?? UPLOAD_ERR_NO_FILE, 'ip' => $ip,
        ]);
        http_response_code($response['status']);
        foreach ($response['headers'] as $name => $value) header($name . ': ' . $value);
        echo $response['body'];
        exit;
    }
    if ($path === '/healthz') {
        PostgresStorage::connect()->get('auth');
        header('Content-Type: text/plain'); echo 'ok'; exit;
    }
    if (preg_match('~^/media/images/[a-f0-9\-]{20,80}$~D', $path)) {
        $object = PostgresStorage::connect()->get(substr($path, 7));
        if ($object === null) { http_response_code(404); exit; }
        $type = $object['metadata']['contentType'] ?? '';
        if (!in_array($type, ['image/png', 'image/jpeg', 'image/webp'], true)) { http_response_code(404); exit; }
        header('Content-Type: ' . $type); header('Cache-Control: public, max-age=31536000, immutable');
        echo $object['data']; exit;
    }
    http_response_code(404); header('Content-Type: text/plain'); echo 'Not found';
} catch (Throwable $error) {
    error_log('Portfolio request failed: ' . get_class($error));
    http_response_code(503); header('Content-Type: application/json'); header('Cache-Control: no-store');
    echo '{"error":"Service unavailable. Check database configuration and try again."}';
}
