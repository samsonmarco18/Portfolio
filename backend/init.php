<?php
declare(strict_types=1);
require_once __DIR__ . '/Storage.php';
try {
    PostgresStorage::connect()->initialize();
    echo "PostgreSQL storage and admin are ready.\n";
} catch (Throwable $error) {
    // PDO messages may contain connection details: keep startup output generic.
    fwrite(STDERR, "Initialization failed. Check DATABASE_URL, database availability/permissions, and ADMIN_PASSWORD (12–72 characters).\n");
    exit(1);
}
