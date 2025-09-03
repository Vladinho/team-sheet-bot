# Настройка питания macOS для стабильной работы Docker бота

## Проблема
На macOS, когда компьютер уходит в сон, Docker контейнеры могут "засыпать" вместе с системой, и бот становится недоступным.

## Решения

### 1. Автоматические настройки (рекомендуется)
Запустите скрипт настройки:
```bash
sudo ./macos_power_settings.sh
```

### 2. Ручные настройки через System Preferences
1. **System Preferences** → **Energy Saver**
2. Отключите "Put hard disks to sleep when possible"
3. Установите "Computer sleep" в "Never"
4. Установите "Display sleep" в "Never"

### 3. Настройки через Terminal
```bash
# Отключить автоматический сон
sudo pmset -a sleep 0

# Отключить выключение дисплея
sudo pmset -a displaysleep 0

# Отключить выключение дисков
sudo pmset -a disksleep 0

# Отключить гибернацию
sudo pmset -a hibernatemode 0

# Включить пробуждение по сети
sudo pmset -a womp 1
```

## Автозагрузка
Скрипт `macos_power_settings.sh` автоматически загружается при старте системы через LaunchAgent.

## Проверка настроек
```bash
pmset -g
```

## Восстановление стандартных настроек
```bash
# Включить автоматический сон (30 минут)
sudo pmset -a sleep 30

# Включить выключение дисплея (10 минут)
sudo pmset -a displaysleep 10

# Включить выключение дисков (10 минут)
sudo pmset -a disksleep 10

# Включить гибернацию
sudo pmset -a hibernatemode 3

# Отключить пробуждение по сети
sudo pmset -a womp 0
```

## Важные замечания
- ⚠️ Настройки сбрасываются при перезагрузке
- 🔄 LaunchAgent автоматически применяет настройки при загрузке
- 💡 Для временного отключения используйте "Prevent Sleep" в меню
- 🚀 Docker контейнеры теперь будут работать стабильно

## Мониторинг
Логи LaunchAgent сохраняются в:
- `/tmp/team-sheet-bot-power.log` - стандартный вывод
- `/tmp/team-sheet-bot-power-error.log` - ошибки
