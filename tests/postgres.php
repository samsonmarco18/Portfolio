<?php
// Run only against a disposable test database; no production records are touched.
declare(strict_types=1);
require_once __DIR__ . '/../backend/Storage.php';
if (!getenv('TEST_DATABASE_URL')) {
    fwrite(STDERR, "Set TEST_DATABASE_URL to a disposable PostgreSQL database.\n");
    exit(1);
}
putenv('DATABASE_URL=' . getenv('TEST_DATABASE_URL'));
putenv('ADMIN_PASSWORD=temporary-test-password');
$first = PostgresStorage::connect();
$first->initialize();
$key = 'test/' . bin2hex(random_bytes(16));
try {
    $bytes = "\x89PNG\x00\xff";
    $first->put($key, $bytes, ['contentType' => 'image/png']);
    $second = PostgresStorage::connect();
    $second->initialize();
    $record = $second->get($key);
    if ($record['data'] !== $bytes || $record['metadata']['contentType'] !== 'image/png') throw new RuntimeException('PostgreSQL round trip failed.');
    $second->put($key, 'updated');
    if ($first->get($key)['data'] !== 'updated') throw new RuntimeException('PostgreSQL upsert failed.');
    $second->delete($key);
    if ($first->get($key) !== null) throw new RuntimeException('PostgreSQL delete failed.');
    echo "PostgreSQL reconnect, Base64 image, upsert, and delete checks passed.\n";
} finally { $first->delete($key); }
