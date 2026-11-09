<?php
declare(strict_types=1);

final class ConfigurationException extends RuntimeException {}

/** Parse independently of PDO so configuration can be validated and tested safely. */
function database_config(string $value): array
{
    $value = trim($value);
    if ($value === '') throw new ConfigurationException('missing_database_url');
    $url = parse_url($value);
    if (!$url || !in_array($url['scheme'] ?? '', ['postgres', 'postgresql'], true)) throw new ConfigurationException('invalid_database_url');
    $host = $url['host'] ?? '';
    $database = rawurldecode(ltrim($url['path'] ?? '', '/'));
    if (!preg_match('/^[a-zA-Z0-9.\-:\[\]]+$/D', $host) || !preg_match('/^[a-zA-Z0-9_\-.]+$/D', $database) || empty($url['user'])) throw new ConfigurationException('invalid_database_url');
    parse_str($url['query'] ?? '', $query);
    $ssl = $query['sslmode'] ?? 'require';
    if (!in_array($ssl, ['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'], true)) throw new ConfigurationException('invalid_sslmode');
    $dsn = sprintf('pgsql:host=%s;port=%d;dbname=%s;sslmode=%s;connect_timeout=15', $host, $url['port'] ?? 5432, $database, $ssl);
    if (isset($query['sslrootcert'])) {
        if (!is_string($query['sslrootcert']) || preg_match('/[;\x00\r\n]/', $query['sslrootcert'])) throw new ConfigurationException('invalid_certificate_path');
        $dsn .= ';sslrootcert=' . $query['sslrootcert'];
    }
    return ['dsn' => $dsn, 'user' => rawurldecode($url['user']), 'password' => rawurldecode($url['pass'] ?? '')];
}

function initial_admin_password(): string
{
    $password = getenv('ADMIN_PASSWORD') ?: '';
    if ($password === '') throw new ConfigurationException('missing_admin_password');
    if (strlen($password) < 12 || strlen($password) > 72) throw new ConfigurationException('invalid_admin_password');
    return $password;
}
