#!/bin/sh
set -eu
php /var/www/html/backend/init.php
port="${PORT:-10000}"
case "$port" in ''|*[!0-9]*) echo 'Invalid PORT' >&2; exit 1;; esac
sed -i "s/^Listen 80$/Listen $port/" /etc/apache2/ports.conf
sed -i "s/\*:10000/*:$port/" /etc/apache2/sites-available/000-default.conf
exec apache2-foreground
