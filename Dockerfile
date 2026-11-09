FROM php:8.5-apache

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev \
    && docker-php-ext-install pdo_pgsql \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html
COPY backend ./backend
COPY db ./db
COPY public ./public
COPY tests ./tests
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf
COPY docker/php.ini /usr/local/etc/php/conf.d/portfolio.ini
COPY docker/start.sh /usr/local/bin/portfolio-start
RUN chmod +x /usr/local/bin/portfolio-start \
    && find backend public tests -name '*.php' -print0 | xargs -0 -n1 php -l
RUN php tests/run.php && php tests/startup.php

EXPOSE 10000
CMD ["portfolio-start"]
