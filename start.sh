#!/bin/bash

echo "🚀 Запуск Team Sheet Bot..."

# Проверяем наличие .env файла
if [ ! -f .env ]; then
    echo "❌ Файл .env не найден!"
    echo "📝 Скопируйте env.example в .env и настройте переменные"
    exit 1
fi

# Проверяем наличие node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 Устанавливаем зависимости..."
    npm install
fi

# Запускаем бота
echo "🤖 Запускаем бота..."
npm start
