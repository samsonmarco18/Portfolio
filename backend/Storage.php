<?php
declare(strict_types=1);
require_once __DIR__ . '/DatabaseConfig.php';

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
        $config = database_config(getenv('DATABASE_URL') ?: '');
        if (!in_array('pgsql', PDO::getAvailableDrivers(), true)) throw new ConfigurationException('missing_pgsql_driver');
        $pdo = new PDO($config['dsn'], $config['user'], $config['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec("SET statement_timeout = '15s'");
        return new self($pdo);
    }

    public function initialize(?callable $progress = null): void
    {
        if ($progress) $progress('schema');
        $this->db->exec(file_get_contents(__DIR__ . '/../db/001_storage.sql'));
        if ($progress) $progress('admin');
        if ($this->get('auth') === null) {
            $password = initial_admin_password();
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
