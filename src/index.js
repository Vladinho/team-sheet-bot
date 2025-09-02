require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const StateManager = require('./stateManager');
const { 
  handleStart, 
  handleCreateGame, 
  handleEndGame,
  handleMessage, 
  handleCallbackQuery,
  restoreStateFromMessage
} = require('./handlers');

// Конфигурация
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID);
const GROUP_ID = process.env.GROUP_ID ? parseInt(process.env.GROUP_ID) : null;

// Создание бота
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Менеджер состояния
const stateManager = new StateManager();

// Хранилище данных (загружается из файла)
let gameSessions, userStates, friends;

// Инициализация состояния
async function initializeState() {
  const state = await stateManager.loadState();
  gameSessions = state.gameSessions;
  userStates = state.userStates;
  friends = state.friends;
  
  // Делаем stateManager доступным глобально для handlers
  global.stateManager = stateManager;
  
  // Запускаем автоматическое сохранение
  stateManager.startAutoSave(gameSessions, userStates, friends);
  
  console.log('Состояние инициализировано');
}

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
    
    handleCreateGame(bot, msg, gameSessions, userStates, playersLimit, gameDescription, friends);
  } else {
    // Обычный /start без параметров
    handleStart(bot, msg, gameSessions, userStates, ADMIN_ID);
  }
});

// Команда просмотра друзей
bot.onText(/\/friends/, (msg) => {
  const userId = msg.from.id;
  const userFriends = friends.get(userId) || [];
  
  console.log(`[DEBUG] Команда /friends: userId=${userId}`);
  console.log(`[DEBUG] Текущее состояние friends:`, Array.from(friends.entries()));
  console.log(`[DEBUG] Друзья пользователя:`, userFriends);
  
  if (userFriends.length === 0) {
    bot.sendMessage(msg.chat.id, 'У вас пока нет друзей в списке.\n\nДобавить друга: + Имя\nУдалить друга: - Имя');
  } else {
    const friendsList = userFriends.map(f => `• ${f.name}`).join('\n');
    bot.sendMessage(msg.chat.id, 
      `🤝 <b>Ваши друзья:</b>\n\n${friendsList}\n\n` +
      `Добавить друга: + Имя\n` +
      `Удалить друга: - Имя`, 
      { parse_mode: 'HTML' }
    );
  }
});

// Отладочная команда для просмотра состояния
bot.onText(/\/debug/, (msg) => {
  const userId = msg.from.id;
  console.log(`[DEBUG] Команда /debug: userId=${userId}`);
  console.log(`[DEBUG] Полное состояние friends:`, Array.from(friends.entries()));
  console.log(`[DEBUG] Игровые сессии:`, Array.from(gameSessions.entries()));
  
  const userFriends = friends.get(userId) || [];
  const debugInfo = `🔍 <b>Отладочная информация:</b>\n\n` +
    `User ID: ${userId}\n` +
    `Друзей в системе: ${friends.size}\n` +
    `Ваших друзей: ${userFriends.length}\n` +
    `Активных игр: ${gameSessions.size}\n\n` +
    `Ваши друзья: ${userFriends.map(f => f.name).join(', ') || 'нет'}`;
  
  bot.sendMessage(msg.chat.id, debugInfo, { parse_mode: 'HTML' });
});

// Команда принудительного сохранения состояния (только для админа)
bot.onText(/\/save/, (msg) => {
  const userId = msg.from.id;
  
  if (userId !== ADMIN_ID) {
    bot.sendMessage(msg.chat.id, 'У вас нет прав для сохранения состояния.');
    return;
  }
  
  stateManager.saveState(gameSessions, userStates, friends);
  bot.sendMessage(msg.chat.id, '✅ Состояние принудительно сохранено в файл.');
});

// Команда завершения игры (только для админа)
bot.onText(/\/end_game/, (msg) => {
  const userId = msg.from.id;
  
  if (userId !== ADMIN_ID) {
    bot.sendMessage(msg.chat.id, 'У вас нет прав для завершения игры.');
    return;
  }
  
  handleEndGame(bot, msg, gameSessions, userStates);
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
    bot.sendMessage(chatId, 'Активная игра уже существует. Сначала завершите текущую игру командой /end_game');
    return;
  }
  
  bot.sendMessage(chatId, 
    'Отправьте текст сообщения с записью на игру для восстановления состояния.\n\n' +
    'Скопируйте и отправьте текст основного сообщения с записью на игру.'
  );
});

// Обработка текстовых сообщений
bot.on('message', (msg) => {
  handleMessage(bot, msg, gameSessions, userStates, friends);
});

// Обработка callback запросов
bot.on('callback_query', (query) => {
  handleCallbackQuery(bot, query, gameSessions, userStates, ADMIN_ID, friends);
});

// Обработка ошибок
bot.on('polling_error', (error) => {
  console.error('Ошибка polling:', error);
});

bot.on('error', (error) => {
  console.error('Ошибка бота:', error);
});

// Обработка сигналов завершения для корректного сохранения состояния
process.on('SIGINT', async () => {
  console.log('\nПолучен сигнал SIGINT, сохраняем состояние...');
  await stateManager.saveState(gameSessions, userStates, friends);
  console.log('Состояние сохранено, завершаем работу...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nПолучен сигнал SIGTERM, сохраняем состояние...');
  await stateManager.saveState(gameSessions, userStates, friends);
  console.log('Состояние сохранено, завершаем работу...');
  process.exit(0);
});

// Инициализация и запуск бота
async function startBot() {
  await initializeState();
  
  console.log('Бот запущен...');
  console.log(`Администратор: ${ADMIN_ID}`);
  console.log(`Группа: ${GROUP_ID || 'не ограничена'}`);
}

// Запускаем бота
startBot().catch(error => {
  console.error('Ошибка запуска бота:', error);
  process.exit(1);
});
