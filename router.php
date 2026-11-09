<?php
// Local development router. Production uses Apache and public/.htaccess.
declare(strict_types=1);
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if (in_array($path, ['/app.js', '/admin.js', '/editor.js', '/styles.css'], true)) return false;
if (in_array($path, ['/default-content.json', '/favicon.svg'], true)
    || preg_match('~^/assets/projects/(quizweb|ddpmss|harvee)/[a-z0-9-]+\.png$~D', $path)) {
    if (is_file(__DIR__ . '/public' . $path)) return false;
}
require __DIR__ . '/public/index.php';
