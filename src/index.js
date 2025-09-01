require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { 
  handleStart, 
  handleCreateGame, 
  handleEndGame,
  handleMessage, 
  handleCallbackQuery 
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

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
  handleStart(bot, msg, gameSessions, userStates);
});

// Команда создания игры (только для админа)
bot.onText(/\/create_game/, (msg) => {
  handleCreateGame(bot, msg, gameSessions, userStates);
});

// Команда завершения игры (только для админа)
bot.onText(/\/end_game/, (msg) => {
  handleEndGame(bot, msg, gameSessions, userStates);
});

// Обработка текстовых сообщений
bot.on('message', (msg) => {
  handleMessage(bot, msg, gameSessions, userStates);
});

// Обработка callback запросов
bot.on('callback_query', (query) => {
  handleCallbackQuery(bot, query, gameSessions, userStates);
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
