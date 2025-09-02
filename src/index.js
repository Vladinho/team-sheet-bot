require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const BotHealthChecker = require('./healthCheck');
const NetworkMonitor = require('./networkMonitor');
const { 
  handleStart, 
  handleCreateGame, 
  handleMessage, 
  handleCallbackQuery,
  restoreStateFromMessage
} = require('./handlers');

// Конфигурация
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID);
const GROUP_ID = process.env.GROUP_ID ? parseInt(process.env.GROUP_ID) : null;

// Переменные для управления переподключением
let bot = null;
let healthChecker = null;
let networkMonitor = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 15; // Увеличиваем лимит
const RECONNECT_DELAY = 3000; // Уменьшаем начальную задержку

// Функция создания бота
function createBot() {
  try {
    console.log('🔄 Создание бота...');
    
    bot = new TelegramBot(BOT_TOKEN, { 
      polling: true,
      // Более агрессивные настройки для стабильности
      polling_options: {
        timeout: 15,        // Увеличиваем таймаут
        limit: 100,
        retryTimeout: 3000, // Уменьшаем retry timeout
        allowed_updates: ['message', 'callback_query'] // Ограничиваем обновления
      }
    });
    
    setupBotHandlers();
    setupErrorHandlers();
    
    // Запускаем проверку здоровья
    if (healthChecker) {
      healthChecker.stop();
    }
    healthChecker = new BotHealthChecker(bot, BOT_TOKEN);
    
    // Запускаем мониторинг сети
    if (networkMonitor) {
      networkMonitor.stop();
    }
    networkMonitor = new NetworkMonitor();
    networkMonitor.onNetworkChange((newIP, oldIP) => {
      console.log(`🚨 Смена сети обнаружена: ${oldIP} → ${newIP}`);
      console.log('🔄 Планирую принудительное переподключение...');
      forceReconnect();
    });
    networkMonitor.start();
    
    console.log('✅ Бот успешно создан и запущен');
    reconnectAttempts = 0; // Сбрасываем счетчик попыток
    
  } catch (error) {
    console.error('❌ Ошибка создания бота:', error.message);
    scheduleReconnect();
  }
}

// Функция принудительного переподключения
function forceReconnect() {
  console.log('🚨 Принудительное переподключение при смене сети...');
  reconnectAttempts = 0; // Сбрасываем счетчик
  scheduleReconnect();
}

// Настройка обработчиков бота
function setupBotHandlers() {
  // Обработка команды /start
  bot.onText(/\/start(?:\s+(\d+)\s+(.+))?/, (msg, match) => {
    if (match && match[1] && match[2]) {
      // Если переданы параметры - создаем игру (только для админа)
      const userId = msg.from.id;
      
      if (userId !== ADMIN_ID) {
        bot.sendMessage(msg.chat.id, 'У вас нет прав для создания игры.');
        return;
      }
      
      const playersLimit = parseInt(match[1]);
      const gameDescription = match[2];
      
      handleCreateGame(bot, msg, gameSessions, userStates, playersLimit, gameDescription);
    } else {
      // Обычный /start без параметров
      handleStart(bot, msg, gameSessions, userStates, ADMIN_ID);
    }
  });

  // Команда восстановления состояния (только для админа)
  bot.onText(/\/restore_state/, (msg) => {
    const userId = msg.from.id;
    
    if (userId !== ADMIN_ID) {
      bot.sendMessage(msg.chat.id, 'У вас нет прав для восстановления состояния.');
      return;
    }
    
    // Проверяем, есть ли уже активная игра
    const chatId = msg.chat.id;
    const existingGame = gameSessions.get(chatId);
    
    if (existingGame) {
      bot.sendMessage(chatId, 'Активная игра уже существует. Сначала завершите текущую игру.');
      return;
    }
    
    bot.sendMessage(chatId, 
      'Отправьте текст сообщения с записью на игру для восстановления состояния.\n\n' +
      'Скопируйте и отправьте текст основного сообщения с записью на игру.'
    );
  });

  // Обработка текстовых сообщений
  bot.on('message', (msg) => {
    handleMessage(bot, msg, gameSessions, userStates);
  });

  // Обработка callback запросов
  bot.on('callback_query', (query) => {
    handleCallbackQuery(bot, query, gameSessions, userStates, ADMIN_ID);
  });
}

// Настройка обработчиков ошибок
function setupErrorHandlers() {
  // Обработка ошибок polling
  bot.on('polling_error', (error) => {
    console.error('❌ Ошибка polling:', error.message);
    
    // Расширенная детекция сетевых проблем
    if (error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'EHOSTUNREACH' ||
        error.message.includes('network') ||
        error.message.includes('timeout') ||
        error.message.includes('connection') ||
        error.message.includes('refused') ||
        error.message.includes('unreachable')) {
      
      console.log('🌐 Обнаружена сетевая ошибка, планирую переподключение...');
      
      // Принудительно проверяем смену сети
      if (networkMonitor) {
        networkMonitor.forceCheck();
      }
      
      // Если это явная сетевая ошибка, сбрасываем счетчик попыток
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        console.log('🔄 Сброс счетчика попыток для сетевых ошибок...');
        reconnectAttempts = Math.max(0, reconnectAttempts - 2);
      }
      
      scheduleReconnect();
    }
  });

  // Общие ошибки бота
  bot.on('error', (error) => {
    console.error('❌ Общая ошибка бота:', error.message);
    
    // Расширенная детекция сетевых проблем
    if (error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'EHOSTUNREACH' ||
        error.message.includes('network') ||
        error.message.includes('timeout') ||
        error.message.includes('connection')) {
      
      console.log('🌐 Обнаружена сетевая ошибка, планирую переподключение...');
      
      // Принудительно проверяем смену сети
      if (networkMonitor) {
        networkMonitor.forceCheck();
      }
      scheduleReconnect();
    }
  });

  // Обработка завершения работы
  bot.on('end', () => {
    console.log('🔄 Соединение с Telegram завершено');
    
    // Проверяем, не сменилась ли сеть
    if (networkMonitor) {
      networkMonitor.forceCheck();
    }
    scheduleReconnect();
  });

  // Обработка разрыва соединения
  bot.on('disconnect', () => {
    console.log('🔌 Соединение с Telegram разорвано');
    
    // Проверяем, не сменилась ли сеть
    if (networkMonitor) {
      networkMonitor.forceCheck();
    }
    scheduleReconnect();
  });
}

// Функция планирования переподключения
function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`❌ Достигнут лимит попыток переподключения (${MAX_RECONNECT_ATTEMPTS})`);
    console.log('🔄 Перезапуск процесса...');
    process.exit(1); // Docker перезапустит контейнер
    return;
  }

  reconnectAttempts++;
  
  // Более агрессивная стратегия переподключения
  let delay;
  if (reconnectAttempts <= 3) {
    // Первые 3 попытки - быстро
    delay = 1000 * reconnectAttempts; // 1с, 2с, 3с
  } else if (reconnectAttempts <= 8) {
    // Следующие 5 попыток - умеренно
    delay = 5000 + (reconnectAttempts - 3) * 2000; // 5с, 7с, 9с, 11с, 13с
  } else {
    // Остальные попытки - экспоненциально
    delay = Math.min(30000, RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts - 8));
  }
  
  console.log(`🔄 Попытка переподключения ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} через ${Math.round(delay/1000)} сек...`);
  
  setTimeout(() => {
    if (bot) {
      try {
        console.log('🔄 Останавливаю старое соединение...');
        bot.stopPolling();
        bot.close();
      } catch (e) {
        console.log('⚠️ Ошибка при закрытии старого соединения:', e.message);
      }
    }
    
    // Небольшая пауза перед созданием нового соединения
    setTimeout(() => {
      createBot();
    }, 1000);
    
  }, delay);
}

// Хранилище данных (в памяти, без БД)
const gameSessions = new Map(); // chatId -> gameData
const userStates = new Map(); // userId -> state

// Обработка сигналов завершения
process.on('SIGINT', () => {
  console.log('🛑 Получен сигнал SIGINT, завершаю работу...');
  if (bot) {
    bot.stopPolling();
    bot.close();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Получен сигнал SIGTERM, завершаю работу...');
  if (bot) {
    bot.stopPolling();
    bot.close();
  }
  process.exit(0);
});

// Запуск бота
console.log('🚀 Запуск бота...');
console.log(`👤 Администратор: ${ADMIN_ID}`);
console.log(`👥 Группа: ${GROUP_ID || 'не ограничена'}`);

createBot();
