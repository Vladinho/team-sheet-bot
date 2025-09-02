# 🐳 Запуск бота в Docker

## 📋 Требования

- Docker
- Docker Compose
- Telegram Bot Token

## 🚀 Быстрый старт

### 1. Настройка переменных окружения

```bash
# Скопируйте файл с примерами
cp env.example .env

# Отредактируйте .env файл
nano .env
```

Заполните в `.env`:
```env
BOT_TOKEN=your_bot_token_here
ADMIN_ID=your_telegram_id_here
GROUP_ID=your_group_id_here
```

### 2. Запуск бота

```bash
# Сделайте скрипт исполняемым
chmod +x docker-start.sh

# Запустите бота
./docker-start.sh
```

### 3. Альтернативный запуск

```bash
# Сборка и запуск
docker-compose up --build -d

# Только запуск (если уже собрано)
docker-compose up -d
```

## 📊 Управление

### Посмотреть логи
```bash
# Все логи
docker-compose logs

# Логи в реальном времени
docker-compose logs -f

# Логи конкретного сервиса
docker-compose logs telegram-bot
```

### Остановка
```bash
# Остановить
docker-compose down

# Остановить и удалить volumes
docker-compose down -v
```

### Перезапуск
```bash
# Перезапустить
docker-compose restart

# Пересобрать и перезапустить
docker-compose up --build -d
```

## 🔧 Полезные команды

```bash
# Статус сервисов
docker-compose ps

# Войти в контейнер
docker-compose exec telegram-bot sh

# Посмотреть использование ресурсов
docker stats
```

## 🐛 Отладка

### Проверить статус
```bash
docker-compose ps
```

### Проверить логи
```bash
docker-compose logs telegram-bot
```

### Пересобрать образ
```bash
docker-compose build --no-cache
docker-compose up -d
```

## 📁 Структура файлов

```
.
├── Dockerfile              # Образ Docker
├── docker-compose.yml      # Конфигурация сервисов
├── .dockerignore          # Исключения для Docker
├── docker-start.sh        # Скрипт запуска
├── .env                   # Переменные окружения
└── src/                   # Исходный код бота
```

## 🌐 Webhook режим (опционально)

Для продакшена можно включить webhook вместо polling:

1. Раскомментируйте порты в `docker-compose.yml`
2. Настройте webhook в коде бота
3. Укажите URL вашего сервера в Telegram

## 💾 Персистентность данных

Данные сохраняются в папке `./data` на хосте через volume mount.

## 🔒 Безопасность

- Контейнер запускается от непривилегированного пользователя
- Переменные окружения не попадают в образ
- Используется Alpine Linux для минимального размера образа
