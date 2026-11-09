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
            if (isset($image['id']) && (!is_string($image['id']) || !preg_match('/^[a-zA-Z0-9-]{1,80}$/D', $image['id']))) return false;
        }
        if (isset($project['layout']) && !valid_layout($project['layout'], $project['images'])) return false;
    }
    return true;
}

function layout_number(mixed $value, float $min, float $max): bool
{
    return (is_int($value) || is_float($value)) && is_finite((float) $value) && $value >= $min && $value <= $max;
}

function valid_layout(mixed $layout, array $images): bool
{
    if (!is_array($layout) || !layout_number($layout['height'] ?? null, 600, 30000)
        || !is_string($layout['background'] ?? null) || !preg_match('/^#[a-fA-F0-9]{6}$/D', $layout['background'])
        || !isset($layout['blocks']) || !is_array($layout['blocks']) || !array_is_list($layout['blocks']) || count($layout['blocks']) > 120) return false;
    $imageIds = [];
    foreach ($images as $image) {
        if (!isset($image['id']) || isset($imageIds[$image['id']])) return false;
        $imageIds[$image['id']] = true;
    }
    $ids = [];
    foreach ($layout['blocks'] as $block) {
        if (!is_array($block) || !text_field($block, 'id', 80) || !preg_match('/^[a-zA-Z0-9-]{1,80}$/D', $block['id']) || isset($ids[$block['id']])
            || !layout_number($block['x'] ?? null, 0, 1200) || !layout_number($block['y'] ?? null, 0, $layout['height'])
            || !layout_number($block['w'] ?? null, 60, 1200) || !layout_number($block['h'] ?? null, 40, $layout['height'])
            || $block['x'] + $block['w'] > 1200.01 || $block['y'] + $block['h'] > $layout['height'] + 0.01) return false;
        $ids[$block['id']] = true;
        if (($block['type'] ?? '') === 'image') {
            if (!is_string($block['imageId'] ?? null) || !isset($imageIds[$block['imageId']]) || !in_array($block['fit'] ?? '', ['contain', 'cover'], true)) return false;
        } elseif (($block['type'] ?? '') === 'text') {
            if (!text_field($block, 'text', 3000) || !layout_number($block['fontSize'] ?? null, 12, 120)
                || !is_string($block['color'] ?? null) || !preg_match('/^#[a-fA-F0-9]{6}$/D', $block['color'])
                || !in_array($block['align'] ?? '', ['left', 'center', 'right'], true) || !in_array($block['weight'] ?? 0, [400, 700], true)) return false;
        } else return false;
    }
    return true;
}

function image_type(string $data): ?string
{
    $info = @getimagesizefromstring($data);
    $type = $info['mime'] ?? '';
    return in_array($type, ['image/png', 'image/jpeg', 'image/webp'], true) ? $type : null;
}
