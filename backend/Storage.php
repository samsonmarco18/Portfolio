<?php
declare(strict_types=1);

interface Storage
{
    /** @return array{data: string, metadata: ?array}|null */
    public function get(string $key): ?array;
    public function put(string $key, string $data, ?array $metadata = null): void;
    public function delete(string $key): void;
}

function read_record(Storage $storage, string $key): ?array
{
    $record = $storage->get($key);
    return $record === null ? null : json_decode($record['data'], true, 512, JSON_THROW_ON_ERROR);
}

function write_record(Storage $storage, string $key, array $value): void
{
    $storage->put($key, json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES));
}

final class PostgresStorage implements Storage
{
    public function __construct(private PDO $db) {}

    public static function connect(): self
    {
        $url = parse_url(getenv('DATABASE_URL') ?: '');
        if (!$url || !in_array($url['scheme'] ?? '', ['postgres', 'postgresql'], true)) {
            throw new RuntimeException('Set DATABASE_URL to a PostgreSQL connection URI.');
        }
        $host = $url['host'] ?? '';
        $database = rawurldecode(ltrim($url['path'] ?? '', '/'));
        if (!preg_match('/^[a-zA-Z0-9.\-:\[\]]+$/D', $host) || !preg_match('/^[a-zA-Z0-9_\-.]+$/D', $database)) {
            throw new RuntimeException('Invalid PostgreSQL host or database name.');
        }
        parse_str($url['query'] ?? '', $query);
        $ssl = $query['sslmode'] ?? 'require';
        if (!in_array($ssl, ['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'], true)) {
            throw new RuntimeException('Invalid database sslmode.');
        }
        $dsn = sprintf('pgsql:host=%s;port=%d;dbname=%s;sslmode=%s;connect_timeout=15', $host, $url['port'] ?? 5432, $database, $ssl);
        if (isset($query['sslrootcert'])) {
            if (!is_string($query['sslrootcert']) || preg_match('/[;\x00\r\n]/', $query['sslrootcert'])) {
                throw new RuntimeException('Invalid certificate path.');
            }
            $dsn .= ';sslrootcert=' . $query['sslrootcert'];
        }
        $pdo = new PDO($dsn, rawurldecode($url['user'] ?? ''), rawurldecode($url['pass'] ?? ''), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec("SET statement_timeout = '15s'");
        return new self($pdo);
    }

    public function initialize(): void
    {
        $this->db->exec(file_get_contents(__DIR__ . '/../db/001_storage.sql'));
        if ($this->get('auth') === null) {
            $password = getenv('ADMIN_PASSWORD') ?: '';
            if (strlen($password) < 12 || strlen($password) > 72) {
                throw new RuntimeException('Set ADMIN_PASSWORD to 12–72 characters.');
            }
            $auth = base64_encode(json_encode(['passwordHash' => password_hash($password, PASSWORD_DEFAULT)], JSON_THROW_ON_ERROR));
            $statement = $this->db->prepare('INSERT INTO portfolio_private.portfolio_objects (object_key, data_base64) VALUES (:key, :data) ON CONFLICT (object_key) DO NOTHING');
            $statement->execute(['key' => 'auth', 'data' => $auth]);
        }
    }

    public function get(string $key): ?array
    {
        $statement = $this->db->prepare('SELECT data_base64, metadata FROM portfolio_private.portfolio_objects WHERE object_key = :key');
        $statement->execute(['key' => $key]);
        $row = $statement->fetch();
        if (!$row) return null;
        $bytes = base64_decode($row['data_base64'], true);
        if ($bytes === false) throw new RuntimeException('Invalid stored data.');
        return ['data' => $bytes, 'metadata' => $row['metadata'] === null ? null : json_decode($row['metadata'], true, 512, JSON_THROW_ON_ERROR)];
    }

    public function put(string $key, string $data, ?array $metadata = null): void
    {
        $statement = $this->db->prepare('INSERT INTO portfolio_private.portfolio_objects (object_key, data_base64, metadata) VALUES (:key, :data, :metadata) ON CONFLICT (object_key) DO UPDATE SET data_base64 = EXCLUDED.data_base64, metadata = EXCLUDED.metadata, updated_at = NOW()');
        $statement->execute(['key' => $key, 'data' => base64_encode($data), 'metadata' => $metadata === null ? null : json_encode($metadata, JSON_THROW_ON_ERROR)]);
    }

    public function delete(string $key): void
    {
        $statement = $this->db->prepare('DELETE FROM portfolio_private.portfolio_objects WHERE object_key = :key');
        $statement->execute(['key' => $key]);
    }
}
