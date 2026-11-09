<?php
declare(strict_types=1);

function text_field(array $data, string $key, int $maximum, bool $required = true): bool
{
    return (!$required && !isset($data[$key])) || (isset($data[$key]) && is_string($data[$key]) && strlen($data[$key]) <= $maximum);
}

function valid_media(string $url): bool
{
    // Includes earlier UUID uploads so existing PostgreSQL content keeps working.
    return (bool) preg_match('~^/media/images/[a-f0-9\-]{20,80}$~D', $url);
}

function valid_content(array $content): bool
{
    if (!text_field($content, 'name', 150) || trim($content['name']) === '' || !text_field($content, 'intro', 1500)
        || !text_field($content, 'about', 10000) || !text_field($content, 'email', 254)
        || ($content['email'] !== '' && !filter_var($content['email'], FILTER_VALIDATE_EMAIL))
        || !text_field($content, 'profile', 200) || ($content['profile'] !== '' && !valid_media($content['profile']))
        || !isset($content['projects']) || !is_array($content['projects']) || !array_is_list($content['projects'])
        || count($content['projects']) < 1 || count($content['projects']) > 30) return false;
    $ids = [];
    foreach ($content['projects'] as $project) {
        if (!is_array($project) || !text_field($project, 'id', 80) || !preg_match('/^[a-z0-9-]+$/D', $project['id']) || isset($ids[$project['id']])
            || !text_field($project, 'title', 250) || trim($project['title']) === '' || !text_field($project, 'category', 150)
            || !text_field($project, 'description', 20000) || !text_field($project, 'role', 10000)
            || !text_field($project, 'theme', 20) || !in_array($project['theme'], ['pink', 'lime', 'blue'], true)
            || !text_field($project, 'url', 2000) || ($project['url'] !== '' && (!filter_var($project['url'], FILTER_VALIDATE_URL) || !in_array(parse_url($project['url'], PHP_URL_SCHEME), ['http', 'https'], true)))
            || !isset($project['technologies']) || !is_array($project['technologies']) || !array_is_list($project['technologies']) || count($project['technologies']) > 50
            || !isset($project['images']) || !is_array($project['images']) || !array_is_list($project['images']) || count($project['images']) > 60) return false;
        $ids[$project['id']] = true;
        foreach ($project['technologies'] as $technology) if (!is_string($technology) || strlen($technology) > 100) return false;
        foreach ($project['images'] as $image) {
            if (!is_array($image) || !text_field($image, 'url', 200) || !valid_media($image['url']) || !text_field($image, 'caption', 3000)) return false;
        }
    }
    return true;
}

function image_type(string $data): ?string
{
    $info = @getimagesizefromstring($data);
    $type = $info['mime'] ?? '';
    return in_array($type, ['image/png', 'image/jpeg', 'image/webp'], true) ? $type : null;
}
