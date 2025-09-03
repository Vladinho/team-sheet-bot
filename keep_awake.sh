#!/bin/bash

# Скрипт для принудительного поддержания macOS в бодрствующем состоянии
# Запускать в фоне для предотвращения сна

echo "🚀 Запуск скрипта поддержания бодрствования..."

# Функция для предотвращения сна
prevent_sleep() {
    while true; do
        # Отправляем команду для предотвращения сна
        caffeinate -i -s -u &
        CAFFEINATE_PID=$!
        
        # Ждем 5 минут
        sleep 300
        
        # Убиваем процесс caffeinate
        kill $CAFFEINATE_PID 2>/dev/null
        
        echo "✅ Система поддерживается в бодрствующем состоянии $(date)"
    done
}

# Функция для мониторинга Docker
monitor_docker() {
    while true; do
        # Проверяем статус контейнера
        if ! docker ps | grep -q "team-sheet-bot"; then
            echo "🚨 Контейнер бота не найден! Перезапускаю..."
            cd /Users/vladislavrepkin/WebstormProjects/team-sheet-bot
            docker-compose up -d
        fi
        
        # Проверяем доступность бота через health check
        if docker exec team-sheet-bot node -e "console.log('Health check passed')" 2>/dev/null; then
            echo "✅ Бот работает нормально $(date)"
        else
            echo "⚠️ Проблема с ботом, перезапускаю..."
            docker-compose restart
        fi
        
        # Ждем 30 секунд
        sleep 30
    done
}

# Запускаем оба процесса в фоне
prevent_sleep &
PREVENT_SLEEP_PID=$!

monitor_docker &
MONITOR_PID=$!

echo "✅ Скрипты запущены с PID: $PREVENT_SLEEP_PID, $MONITOR_PID"
echo "💡 Для остановки: kill $PREVENT_SLEEP_PID $MONITOR_PID"

# Ждем сигнала завершения
trap "echo '🛑 Останавливаю скрипты...'; kill $PREVENT_SLEEP_PID $MONITOR_PID; exit" INT TERM

# Держим скрипт активным
wait
