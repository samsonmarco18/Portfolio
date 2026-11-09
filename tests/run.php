<?php
declare(strict_types=1);
require_once __DIR__ . '/../backend/Api.php';

final class MemoryStorage implements Storage
{
    public array $objects = [];
    public function get(string $key): ?array { return $this->objects[$key] ?? null; }
    public function put(string $key, string $data, ?array $metadata = null): void { $this->objects[$key] = ['data' => $data, 'metadata' => $metadata]; }
    public function delete(string $key): void { unset($this->objects[$key]); }
}

function check(bool $condition, string $label): void
{
    if (!$condition) throw new RuntimeException('FAIL: ' . $label);
    echo 'PASS: ' . $label . "\n";
}

$storage = new MemoryStorage();
$api = new Api($storage);
$call = function (string $path, string $method = 'GET', ?array $body = null, string $token = '', array $extra = []) use ($api): array {
    return $api->handle(array_merge(['path' => $path, 'method' => $method, 'body' => $body === null ? '' : json_encode($body), 'token' => $token, 'origin' => 'https://portfolio.test', 'expectedOrigin' => 'https://portfolio.test', 'ip' => '127.0.0.1'], $extra));
};

$content = json_decode($call('/api/content')['body'], true, 512, JSON_THROW_ON_ERROR);
check($content['name'] === 'Marco Samson' && count($content['projects']) === 3, 'public content contains all three projects');
check(valid_content($content), 'default content satisfies validation');
check($call('/api/content', 'PUT', $content)['status'] === 401, 'anonymous writes are denied');
check($call('/api/login', 'POST', ['password' => 'test-password-123'])['status'] === 503, 'public password registration is disabled');
write_record($storage, 'auth', ['passwordHash' => password_hash('test-password-123', PASSWORD_DEFAULT)]);
$login = $call('/api/login', 'POST', ['password' => 'test-password-123']);
check($login['status'] === 200, 'PHP password verification signs in');
check(str_contains($login['headers']['Set-Cookie'], 'HttpOnly; SameSite=Strict; Max-Age=28800; Secure'), 'session cookie has secure flags');
preg_match('/portfolio_session=([a-f0-9]+)/', $login['headers']['Set-Cookie'], $match);
$token = $match[1];
$content['linkedin'] = 'https://www.linkedin.com/in/marco-example';
$content['facebook'] = 'https://www.facebook.com/marco-example';
$content['github'] = 'https://github.com/marco-example';
$content['email'] = 'marco-example@gmail.com';
check($call('/api/content', 'PUT', $content, $token)['status'] === 200, 'contact and social profiles save');
$socialSaved = json_decode($call('/api/content')['body'], true);
check($socialSaved['linkedin'] === $content['linkedin'] && $socialSaved['facebook'] === $content['facebook'] && $socialSaved['github'] === $content['github'] && $socialSaved['email'] === $content['email'], 'all four contact links persist');
foreach (['javascript:alert(1)', 'http://github.com/example', 'https://user:password@github.com/example'] as $unsafe) {
    $badSocial = $content; $badSocial['github'] = $unsafe;
    check($call('/api/content', 'PUT', $badSocial, $token)['status'] === 400, 'unsafe social profile URL rejected');
}
$legacy = $content; unset($legacy['linkedin'], $legacy['facebook'], $legacy['github']);
check(valid_content($legacy), 'existing profiles without social fields remain valid');
check(json_decode($call('/api/status', token: $token)['body'], true)['authenticated'], 'session is stored server-side');
check($call('/api/content', 'PUT', $content, $token, ['origin' => 'https://attacker.test'])['status'] === 403, 'cross-origin writes are denied');
check($call('/api/content', 'PUT', null, $token, ['body' => '{bad json'])['status'] === 400, 'malformed JSON is rejected');

$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5s8AAAAASUVORK5CYII=');
$upload = $call('/api/upload', 'POST', null, $token, ['image' => $png]);
check($upload['status'] === 200, 'real PNG upload is accepted');
$url = json_decode($upload['body'], true)['url'];
$image = $storage->get(substr($url, 7));
check($image['data'] === $png && $image['metadata']['contentType'] === 'image/png', 'image bytes and MIME type survive storage');
check($call('/api/upload', 'POST', null, $token, ['image' => '<svg onload="alert(1)"></svg>'])['status'] === 400, 'SVG or fake image upload is rejected');
check($call('/api/upload', 'POST', null, $token, ['image' => str_repeat('x', 10 * 1024 * 1024 + 1)])['status'] === 413, 'oversized upload is rejected');
$content['projects'][0]['images'] = [['url' => $url, 'caption' => 'A saved screenshot']];
$content['projects'][0]['technologies'] = ['PHP', 'PostgreSQL'];
$content['profile'] = $url;
check($call('/api/content', 'PUT', $content, $token)['status'] === 200, 'editor saves gallery, technologies and profile');
$saved = json_decode((new Api($storage))->handle(['path' => '/api/content', 'method' => 'GET', 'expectedOrigin' => 'https://portfolio.test'])['body'], true);
check($saved['projects'][0]['images'][0]['caption'] === 'A saved screenshot' && $saved['profile'] === $url, 'new API instance loads saved content');
$secondUpload = $call('/api/upload', 'POST', null, $token, ['image' => $png]);
$secondUrl = json_decode($secondUpload['body'], true)['url'];
$content['projects'][0]['images'] = [
    ['id' => 'picture-one', 'url' => $url, 'caption' => 'First picture'],
    ['id' => 'picture-two', 'url' => $secondUrl, 'caption' => 'Second picture'],
];
$content['projects'][0]['layout'] = ['height' => 1400, 'background' => '#1e211f', 'blocks' => [
    ['id' => 'image-one', 'type' => 'image', 'imageId' => 'picture-one', 'x' => 48.5, 'y' => 180, 'w' => 540, 'h' => 500, 'fit' => 'contain'],
    ['id' => 'image-two', 'type' => 'image', 'imageId' => 'picture-two', 'x' => 612, 'y' => 180, 'w' => 540, 'h' => 500, 'fit' => 'cover'],
    ['id' => 'heading-one', 'type' => 'text', 'text' => 'A visual project story', 'x' => 48, 'y' => 40, 'w' => 1104, 'h' => 100, 'fontSize' => 64, 'color' => '#d5f878', 'align' => 'left', 'weight' => 700],
]];
check($call('/api/content', 'PUT', $content, $token)['status'] === 200, 'multiple pictures and draggable text/image layout save together');
$canvasSaved = json_decode($call('/api/content')['body'], true)['projects'][0];
check(count($canvasSaved['images']) === 2 && $canvasSaved['layout']['blocks'][0]['x'] === 48.5 && $canvasSaved['layout']['blocks'][2]['fontSize'] === 64, 'saved canvas keeps every picture, position, size and text style');
$badLayout = $content; $badLayout['projects'][0]['layout']['blocks'][0]['w'] = 2000;
check($call('/api/content', 'PUT', $badLayout, $token)['status'] === 400, 'canvas elements cannot exceed canvas bounds');
$badLayout = $content; $badLayout['projects'][0]['layout']['blocks'][0]['imageId'] = 'unknown-picture';
check(!valid_content($badLayout), 'canvas rejects references to missing pictures');
$badLayout = $content; $badLayout['projects'][0]['layout']['background'] = 'url(javascript:alert(1))';
check(!valid_content($badLayout), 'canvas colors cannot inject CSS');
$badLayout = $content; $badLayout['projects'][0]['layout']['blocks'][2]['fontSize'] = -2;
check(!valid_content($badLayout), 'text size must remain in the supported range');
$bad = $content; $bad['projects'][0]['url'] = 'javascript:alert(1)';
check($call('/api/content', 'PUT', $bad, $token)['status'] === 400, 'unsafe project links are rejected');
$bad = $content; $bad['projects'][0]['images'][0]['url'] = '/media/auth';
check($call('/api/content', 'PUT', $bad, $token)['status'] === 400, 'gallery cannot reference private records');
$bad = $content; $bad['projects'][1]['id'] = $bad['projects'][0]['id'];
check(!valid_content($bad), 'duplicate project routes are rejected');
check($call('/api/logout', 'POST', [], $token)['status'] === 200 && $call('/api/content', 'PUT', $content, $token)['status'] === 401, 'logout invalidates the server session');
for ($i = 0; $i < 8; $i++) $call('/api/login', 'POST', ['password' => 'incorrect'], extra: ['ip' => '192.0.2.8']);
check($call('/api/login', 'POST', ['password' => 'incorrect'], extra: ['ip' => '192.0.2.8'])['status'] === 429, 'login attempts are rate limited');

$salt = 'existing-node-salt';
write_record($storage, 'auth', ['salt' => $salt, 'digest' => hash_pbkdf2('sha256', 'old-node-password', $salt, 100000, 64)]);
check($call('/api/login', 'POST', ['password' => 'old-node-password'])['status'] === 200, 'existing Node password records remain valid');
check(isset(read_record($storage, 'auth')['passwordHash']), 'legacy password record upgrades to PHP hashing');

echo "All PHP API checks passed.\n";
