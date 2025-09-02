require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
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

// Хранилище данных (в памяти, без БД)
const gameSessions = new Map(); // chatId -> gameData
const userStates = new Map(); // userId -> state
const friends = new Map(); // userId -> [{name, addedBy}]

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

console.log('Бот запущен...');
console.log(`Администратор: ${ADMIN_ID}`);
console.log(`Группа: ${GROUP_ID || 'не ограничена'}`);
