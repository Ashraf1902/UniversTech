FROM php:8.3-fpm-alpine

RUN apk add --no-cache \
        $PHPIZE_DEPS \
        libzip-dev \
        icu-dev \
        oniguruma-dev \
        libpq \
        postgresql-dev \
        libcurl \
        curl \
    && docker-php-ext-install \
        pdo \
        pdo_mysql \
        pgsql \
        pdo_pgsql \
        mbstring \
        curl \
        zip \
        intl \
        bcmath \
        opcache \
        exif \
    && docker-php-ext-enable opcache

RUN set -eux; \
    addgroup -g 1000 app; \
    adduser -u 1000 -G app -D -H app

WORKDIR /var/www/html

COPY --chown=app:app composer.json composer.lock ./
RUN composer install --no-interaction --no-progress --prefer-dist --no-scripts --no-autoloader

COPY --chown=app:app . .

RUN composer dump-autoload --optimize

RUN mkdir -p \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/views \
        storage/logs \
        bootstrap/cache \
        public/uploads/events \
        public/uploads/images/courses/covers \
        public/uploads/images/events \
        public/uploads/images/schedules \
        public/uploads/lectures \
    && chmod -R ug+rwx storage bootstrap/cache public/uploads \
    && chown -R app:app storage bootstrap/cache public/uploads

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER app

EXPOSE 9000

ENTRYPOINT ["entrypoint.sh"]
CMD ["php-fpm"]