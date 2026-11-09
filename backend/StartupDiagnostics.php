<?php
declare(strict_types=1);
require_once __DIR__ . '/DatabaseConfig.php';

function startup_sqlstate(Throwable $error): string
{
    $code = $error instanceof PDOException ? ($error->errorInfo[0] ?? $error->getCode()) : '';
    return is_string($code) && preg_match('/^[0-9A-Z]{5}$/D', $code) ? $code : '';
}

/** Return only fixed messages. Never emit raw PDO errors, URIs, SQL, or secrets. */
function startup_error_message(Throwable $error, string $stage): string
{
    if ($error instanceof ConfigurationException) {
        return match ($error->getMessage()) {
            'missing_database_url' => 'DATABASE_URL is missing. Sync the Blueprint or set it to the database Internal Database URL.',
            'invalid_database_url' => 'DATABASE_URL is invalid. Use a full postgres:// or postgresql:// URI without surrounding quotes.',
            'invalid_sslmode' => 'DATABASE_URL has an invalid sslmode. Keep the TLS settings supplied by your database provider.',
            'invalid_certificate_path' => 'The database certificate path is invalid.',
            'missing_pgsql_driver' => 'The PHP pdo_pgsql extension is missing. Rebuild using the supplied Dockerfile.',
            'missing_admin_password' => 'ADMIN_PASSWORD is missing. Set it on the web service Environment page or sync the updated Blueprint.',
            'invalid_admin_password' => 'ADMIN_PASSWORD must be 12-72 bytes. Update it on the web service Environment page.',
            default => 'Application configuration is invalid.',
        };
    }
    $state = startup_sqlstate($error);
    $message = strtolower($error->getMessage());
    if ($state === '28P01' || str_contains($message, 'password authentication failed')) return 'PostgreSQL rejected its database username/password. Re-sync DATABASE_URL from the database; this is not the admin login password.';
    if ($state === '3D000' || str_contains($message, 'database') && str_contains($message, 'does not exist')) return 'The database named in DATABASE_URL does not exist. Use the database Internal Database URL.';
    if ($state === '42501') return 'The database user lacks schema/table permissions. Use the database owner connection for initial setup.';
    if (str_contains($message, 'could not translate host name') || str_contains($message, 'name or service not known')) return 'The database hostname cannot be resolved. Confirm DATABASE_URL and that web service and database are in the same Render region.';
    if (str_contains($message, 'ssl') || str_contains($message, 'certificate')) return 'Database TLS negotiation failed. Check the provider TLS settings in DATABASE_URL; do not disable TLS on an external connection.';
    if (str_starts_with($state, '08') || in_array($state, ['57P03', '53300'], true)) return 'PostgreSQL is unreachable or not ready. Check database status, region, and the Internal Database URL.';
    return match ($stage) {
        'schema' => 'Database schema initialization failed. Check database owner permissions and existing table structure.',
        'admin' => 'Admin record initialization failed. Check the auth record and database write permissions.',
        default => 'Database connection failed. Check database status and DATABASE_URL on the web service.',
    };
}

function retry_startup(Throwable $error, string $stage): bool
{
    $state = startup_sqlstate($error);
    return $stage === 'connection' && !($error instanceof ConfigurationException)
        && (str_starts_with($state, '08') || in_array($state, ['57P03', '53300'], true));
}
