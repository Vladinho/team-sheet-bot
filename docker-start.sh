#!/bin/bash

# Проверяем наличие .env файла
if [ ! -f .env ]; then
    echo "❌ Файл .env не найден!"
    echo "📝 Скопируйте env.example в .env и заполните переменные:"
    echo "   cp env.example .env"
    echo "   # Отредактируйте .env файл"
    exit 1
fi

# Проверяем Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен!"
    echo "📥 Установите Docker с https://docker.com"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose не установлен!"
    echo "📥 Установите Docker Compose"
    exit 1
fi

echo "🚀 Запускаю Telegram бота в Docker..."

# Создаем папку для логов если её нет
mkdir -p logs

# Собираем и запускаем
docker-compose up --build -d

echo "✅ Бот запущен!"
echo "📊 Посмотреть логи: docker-compose logs -f"
echo "🛑 Остановить: docker-compose down"
echo "🔄 Перезапустить: docker-compose restart"
