<?php
// Local development router. Production uses Apache and public/.htaccess.
declare(strict_types=1);
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if (in_array($path, ['/app.js', '/styles.css'], true)) return false;
require __DIR__ . '/public/index.php';
