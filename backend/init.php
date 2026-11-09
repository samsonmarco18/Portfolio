<?php
declare(strict_types=1);
require_once __DIR__ . '/Storage.php';
require_once __DIR__ . '/StartupDiagnostics.php';
for ($attempt = 1; $attempt <= 3; $attempt++) {
    $stage = 'connection';
    try {
        echo "Startup: connecting to PostgreSQL (attempt $attempt/3).\n";
        $storage = PostgresStorage::connect();
        $storage->initialize(function (string $next) use (&$stage): void {
            $stage = $next;
            echo $next === 'schema' ? "Startup: checking database schema.\n" : "Startup: checking admin authentication.\n";
        });
        echo "PostgreSQL storage and admin are ready.\n";
        exit(0);
    } catch (Throwable $error) {
        $state = startup_sqlstate($error);
        fwrite(STDERR, "Initialization failed [$stage" . ($state !== '' ? ", SQLSTATE $state" : '') . ']: ' . startup_error_message($error, $stage) . "\n");
        if ($attempt === 3 || !retry_startup($error, $stage)) exit(1);
        echo "Startup: waiting briefly for the database to become ready.\n";
        sleep($attempt * 2);
    }
}
