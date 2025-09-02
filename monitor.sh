#!/bin/bash

# Скрипт мониторинга Telegram бота
# Автоматически перезапускает бота при проблемах с соединением и смене сети

BOT_NAME="team-sheet-bot"
LOG_FILE="logs/bot-monitor.log"
CHECK_INTERVAL=30  # Проверяем каждые 30 секунд (быстрее)
MAX_FAILURES=2     # Уменьшаем лимит для быстрого реагирования
NETWORK_CHECK_INTERVAL=60  # Проверяем сеть каждую минуту

# Создаем папку для логов если её нет
mkdir -p logs

# Функция логирования
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Функция получения текущего IP
get_current_ip() {
    local ip=""
    
    # Пробуем разные сервисы
    local services=(
        "https://api.ipify.org?format=json"
        "https://ipinfo.io/json"
        "https://httpbin.org/ip"
    )
    
    for service in "${services[@]}"; do
        ip=$(curl -s --max-time 10 "$service" 2>/dev/null | grep -o '"ip":"[^"]*"' | cut -d'"' -f4)
        if [ -n "$ip" ]; then
            echo "$ip"
            return 0
        fi
    done
    
    return 1
}

# Функция проверки здоровья бота
check_bot_health() {
    # Проверяем, что контейнер запущен
    if ! docker-compose ps | grep -q "$BOT_NAME.*Up"; then
        log "❌ Контейнер $BOT_NAME не запущен"
        return 1
    fi
    
    # Проверяем логи на наличие критических ошибок
    local error_count=$(docker-compose logs --tail=100 "$BOT_NAME" 2>/dev/null | grep -c "Ошибка\|Error\|Unauthorized\|ECONNRESET\|ETIMEDOUT")
    
    if [ "$error_count" -gt 0 ]; then
        log "⚠️ Обнаружено $error_count ошибок в логах"
        
        # Проверяем последние ошибки
        local last_errors=$(docker-compose logs --tail=20 "$BOT_NAME" 2>/dev/null | grep -E "(Ошибка|Error|Unauthorized|ECONNRESET|ETIMEDOUT)" | tail -3)
        log "Последние ошибки: $last_errors"
        
        return 1
    fi
    
    # Проверяем API Telegram
    local token=$(grep "BOT_TOKEN=" .env | cut -d'=' -f2)
    if [ -n "$token" ]; then
        local api_response=$(curl -s --max-time 10 "https://api.telegram.org/bot$token/getMe" 2>/dev/null)
        if echo "$api_response" | grep -q '"ok":true'; then
            log "✅ API Telegram отвечает корректно"
            return 0
        else
            log "❌ API Telegram не отвечает: $api_response"
            return 1
        fi
    fi
    
    return 0
}

# Функция проверки сети
check_network() {
    local current_ip=$(get_current_ip)
    
    if [ -z "$current_ip" ]; then
        log "⚠️ Не удалось получить текущий IP адрес"
        return 1
    fi
    
    # Сохраняем IP в файл для сравнения
    local ip_file="logs/current_ip.txt"
    local previous_ip=""
    
    if [ -f "$ip_file" ]; then
        previous_ip=$(cat "$ip_file")
    fi
    
    if [ -n "$previous_ip" ] && [ "$previous_ip" != "$current_ip" ]; then
        log "🌐 Обнаружена смена IP: $previous_ip → $current_ip"
        log "🚨 Планирую принудительный перезапуск бота..."
        
        # Принудительно перезапускаем бота при смене сети
        force_restart_bot
        return 1
    fi
    
    # Сохраняем текущий IP
    echo "$current_ip" > "$ip_file"
    return 0
}

# Функция принудительного перезапуска
force_restart_bot() {
    log "🚨 Принудительный перезапуск при смене сети..."
    
    # Останавливаем бота
    docker-compose stop "$BOT_NAME"
    sleep 3
    
    # Запускаем бота
    docker-compose up -d "$BOT_NAME"
    sleep 15
    
    # Проверяем, что бот запустился
    if docker-compose ps | grep -q "$BOT_NAME.*Up"; then
        log "✅ Бот успешно перезапущен после смены сети"
        return 0
    else
        log "❌ Ошибка при перезапуске бота"
        return 1
    fi
}

# Функция перезапуска бота
restart_bot() {
    log "🔄 Перезапуск бота..."
    
    # Останавливаем бота
    docker-compose stop "$BOT_NAME"
    sleep 5
    
    # Запускаем бота
    docker-compose up -d "$BOT_NAME"
    sleep 10
    
    # Проверяем, что бот запустился
    if docker-compose ps | grep -q "$BOT_NAME.*Up"; then
        log "✅ Бот успешно перезапущен"
        return 0
    else
        log "❌ Ошибка при перезапуске бота"
        return 1
    fi
}

# Основной цикл мониторинга
main() {
    log "🚀 Запуск улучшенного мониторинга бота $BOT_NAME"
    
    local failure_count=0
    local network_check_counter=0
    
    while true; do
        # Проверяем здоровье бота
        if check_bot_health; then
            if [ $failure_count -gt 0 ]; then
                log "✅ Бот восстановился после $failure_count неудачных проверок"
                failure_count=0
            fi
            log "✅ Бот работает нормально"
        else
            ((failure_count++))
            log "❌ Проверка $failure_count/$MAX_FAILURES не прошла"
            
            if [ $failure_count -ge $MAX_FAILURES ]; then
                log "🚨 Достигнут лимит неудачных проверок, перезапускаю бота"
                if restart_bot; then
                    failure_count=0
                else
                    log "💥 Критическая ошибка при перезапуске бота"
                fi
            fi
        fi
        
        # Проверяем сеть каждые N проверок
        ((network_check_counter++))
        if [ $network_check_counter -ge $((NETWORK_CHECK_INTERVAL / CHECK_INTERVAL)) ]; then
            check_network
            network_check_counter=0
        fi
        
        sleep $CHECK_INTERVAL
    done
}

# Обработка сигналов завершения
trap 'log "🛑 Мониторинг остановлен"; exit 0' SIGINT SIGTERM

# Запуск мониторинга
main
