<?php
declare(strict_types=1);
require_once __DIR__ . '/../backend/StartupDiagnostics.php';

function verify_startup(bool $condition, string $label): void
{
    if (!$condition) throw new RuntimeException('FAIL: ' . $label);
    echo 'PASS: ' . $label . "\n";
}

$config = database_config("  postgresql://portfolio:encoded%40password@dpg-example-a:5432/portfolio  \n");
verify_startup($config['password'] === 'encoded@password' && $config['user'] === 'portfolio', 'Render URI credentials decode correctly');
verify_startup(str_contains($config['dsn'], 'sslmode=require') && str_contains($config['dsn'], 'host=dpg-example-a'), 'Render connection keeps TLS required');
$external = database_config('postgresql://user:secret@example.com/database?sslmode=verify-full');
verify_startup(str_contains($external['dsn'], 'sslmode=verify-full'), 'external certificate verification is preserved');
foreach (['', '"postgresql://user:secret@host/database"', 'postgresql://host/database', 'postgresql://user:secret@host/database?sslmode=invalid'] as $uri) {
    try { database_config($uri); throw new RuntimeException('Invalid configuration accepted'); }
    catch (ConfigurationException $error) { verify_startup(!str_contains(startup_error_message($error, 'connection'), 'secret@'), 'invalid database configuration has a safe diagnostic'); }
}
$previous = getenv('ADMIN_PASSWORD');
try {
    foreach (['' => 'missing_admin_password', 'short' => 'invalid_admin_password'] as $password => $code) {
        putenv('ADMIN_PASSWORD=' . $password);
        try { initial_admin_password(); throw new RuntimeException('Invalid password accepted'); }
        catch (ConfigurationException $error) { verify_startup($error->getMessage() === $code, 'missing/short admin password is identified precisely'); }
    }
    putenv('ADMIN_PASSWORD=' . base64_encode(str_repeat('x', 32)));
    verify_startup(strlen(initial_admin_password()) === 44, 'Render generated secret satisfies password requirements');
} finally { $previous === false ? putenv('ADMIN_PASSWORD') : putenv('ADMIN_PASSWORD=' . $previous); }

$failure = new PDOException('Connection failed for postgresql://user:private-secret@example.com/db');
$failure->errorInfo = ['08006', 7, 'private-secret'];
verify_startup(retry_startup($failure, 'connection'), 'temporary database connection failure is retried');
verify_startup(!retry_startup($failure, 'schema'), 'schema failure is not retried blindly');
verify_startup(!str_contains(startup_error_message($failure, 'connection'), 'private-secret'), 'database exception credentials are never logged');
$failure->errorInfo = ['28P01', 7, 'private-secret'];
verify_startup(str_contains(startup_error_message($failure, 'connection'), 'database username/password') && !retry_startup($failure, 'connection'), 'database password failure is distinguished from admin password');
$failure->errorInfo = ['42501', 7, 'private-secret'];
verify_startup(str_contains(startup_error_message($failure, 'schema'), 'permissions'), 'schema permission failure has a specific diagnostic');
echo "All startup checks passed.\n";
