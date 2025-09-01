const GameSession = require('./GameSession');

// Состояния пользователя
const UserState = {
  IDLE: 'idle',
  CREATING_GAME: 'creating_game',
  ENTERING_PLAYERS_LIMIT: 'entering_players_limit'
};

// Обработка команды /start
function handleStart(bot, msg, gameSessions, userStates) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const GROUP_ID = process.env.GROUP_ID ? parseInt(process.env.GROUP_ID) : null;
  const ADMIN_ID = parseInt(process.env.ADMIN_ID);
  
  if (GROUP_ID && chatId !== GROUP_ID) {
    bot.sendMessage(chatId, 'Этот бот работает только в определенной группе.');
    return;
  }

  if (userId === ADMIN_ID) {
    bot.sendMessage(chatId, 
      'Привет! Ты администратор. Используй /create_game для создания записи на игру.',
      { reply_markup: { keyboard: [['/create_game']], resize_keyboard: true } }
    );
  } else {
    bot.sendMessage(chatId, 'Привет! Ожидай создания записи на игру от администратора.');
  }
}

// Команда создания игры (только для админа)
function handleCreateGame(bot, msg, gameSessions, userStates) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const ADMIN_ID = parseInt(process.env.ADMIN_ID);
  const GROUP_ID = process.env.GROUP_ID ? parseInt(process.env.GROUP_ID) : null;

  if (userId !== ADMIN_ID) {
    bot.sendMessage(chatId, 'У вас нет прав для создания игры.');
    return;
  }

  if (GROUP_ID && chatId !== GROUP_ID) {
    bot.sendMessage(chatId, 'Игры можно создавать только в определенной группе.');
    return;
  }

  userStates.set(userId, UserState.CREATING_GAME);
  
  const keyboard = [
    [{ text: '10 (по умолчанию)', callback_data: 'create_game_10' }],
    [{ text: 'Другое количество', callback_data: 'create_game_custom' }],
    [{ text: 'Отмена', callback_data: 'cancel_create_game' }]
  ];
  
  bot.sendMessage(chatId, 
    'Создание записи на игру. Выберите количество мест:',
    { reply_markup: { inline_keyboard: keyboard } }
  );
}

// Команда завершения игры (только для админа)
function handleEndGame(bot, msg, gameSessions, userStates) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const ADMIN_ID = parseInt(process.env.ADMIN_ID);

  if (userId !== ADMIN_ID) {
    bot.sendMessage(chatId, 'У вас нет прав для завершения игры.');
    return;
  }

  const gameSession = gameSessions.get(chatId);
  if (!gameSession) {
    bot.sendMessage(chatId, 'Активная игра не найдена.');
    return;
  }

  gameSession.isActive = false;
  updateGameMessage(bot, gameSession);
  // Не отправляем сообщение о завершении - просто обновляем основное сообщение
}

// Обработка текстовых сообщений
async function handleMessage(bot, msg, gameSessions, userStates) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;

  const state = userStates.get(userId);
  
  if (state === UserState.CREATING_GAME) {
    if (text === 'Отмена') {
      userStates.delete(userId);
      bot.sendMessage(chatId, ' ', { reply_markup: { remove_keyboard: true } }).then(msg => {
        setTimeout(() => bot.deleteMessage(chatId, msg.message_id), 100);
      });
      return;
    }

    // Сразу удаляем сообщение с количеством мест для чистоты чата
    bot.deleteMessage(chatId, msg.message_id);

    let playersLimit = 10;
    if (text !== '10 (по умолчанию)') {
      const limit = parseInt(text);
      if (isNaN(limit) || limit <= 0) {
        bot.sendMessage(chatId, 'Пожалуйста, введите корректное число мест.').then(msg => {
          setTimeout(() => bot.deleteMessage(chatId, msg.message_id), 5000);
        });
        return;
      }
      playersLimit = limit;
    }

    // Создаем игру
    const gameMessage = await bot.sendMessage(chatId, 'Создание игры...');
    const gameSession = new GameSession(chatId, gameMessage.message_id, playersLimit);
    gameSessions.set(chatId, gameSession);
    
    await updateGameMessage(bot, gameSession);
    userStates.delete(userId);
    
    // Убираем сообщение с клавиатурой и не отправляем подтверждение
    bot.sendMessage(chatId, ' ', { reply_markup: { remove_keyboard: true } }).then(msg => {
      setTimeout(() => bot.deleteMessage(chatId, msg.message_id), 100);
    });
  }
  
  else if (state === UserState.ENTERING_PLAYERS_LIMIT) {
    if (text === 'Отмена') {
      userStates.delete(userId);
      bot.sendMessage(chatId, ' ', { reply_markup: { remove_keyboard: true } }).then(msg => {
        setTimeout(() => bot.deleteMessage(chatId, msg.message_id), 100);
      });
      return;
    }

    // Сразу удаляем сообщение с количеством мест для чистоты чата
    bot.deleteMessage(chatId, msg.message_id);

    const limit = parseInt(text);
    if (isNaN(limit) || limit <= 0) {
      bot.sendMessage(chatId, 'Пожалуйста, введите корректное число мест.').then(msg => {
        setTimeout(() => bot.deleteMessage(chatId, msg.message_id), 5000);
      });
      return;
    }

    // Создаем игру с указанным количеством мест
    const gameMessage = await bot.sendMessage(chatId, 'Создание игры...');
    const gameSession = new GameSession(chatId, gameMessage.message_id, limit);
    gameSessions.set(chatId, gameSession);
    
    await updateGameMessage(bot, gameSession);
    userStates.delete(userId);
    
    // Убираем сообщение с клавиатурой
    bot.sendMessage(chatId, ' ', { reply_markup: { remove_keyboard: true } }).then(msg => {
      setTimeout(() => bot.deleteMessage(chatId, msg.message_id), 100);
    });
  }
  

}

// Обработка callback запросов
async function handleCallbackQuery(bot, query, gameSessions, userStates) {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;
  const messageId = query.message.message_id;

  // Проверяем, не является ли это callback для создания игры
  if (data.startsWith('create_game_') || data === 'cancel_create_game') {
    // Это callback для создания игры, пропускаем проверку
  } else {
    const gameSession = gameSessions.get(chatId);
    if (!gameSession || gameSession.messageId !== messageId) {
      bot.answerCallbackQuery(query.id, { text: 'Игра не найдена или устарела.' });
      return;
    }
  }

  const username = query.from.username;
  const firstName = query.from.first_name;
  const lastName = query.from.last_name;

  switch (data) {
    case 'create_game_10':
      // Создаем игру с 10 местами
      const gameMessage = await bot.sendMessage(chatId, 'Создание игры...');
      const gameSession = new GameSession(chatId, gameMessage.message_id, 10);
      gameSessions.set(chatId, gameSession);
      
      await updateGameMessage(bot, gameSession);
      userStates.delete(userId);
      
      // Удаляем сообщение с выбором
      bot.deleteMessage(chatId, query.message.message_id);
      bot.answerCallbackQuery(query.id, { text: 'Игра создана!' });
      break;

    case 'create_game_custom':
      // Переключаемся на ввод произвольного количества
      userStates.set(userId, UserState.ENTERING_PLAYERS_LIMIT);
      bot.editMessageText('Введите количество мест:', {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: { keyboard: [['Отмена']], resize_keyboard: true }
      });
      bot.answerCallbackQuery(query.id);
      break;

    case 'cancel_create_game':
      userStates.delete(userId);
      bot.deleteMessage(chatId, query.message.message_id);
      bot.answerCallbackQuery(query.id, { text: 'Создание игры отменено' });
      break;

    case 'register':
      const currentGameSession = gameSessions.get(chatId);
      if (currentGameSession.players.find(p => p.userId === userId) || 
          currentGameSession.reserve.find(p => p.userId === userId)) {
        bot.answerCallbackQuery(query.id, { text: 'Вы уже записаны!' });
        return;
      }

      const isMain = currentGameSession.addPlayer(userId, username, firstName, lastName);
      await updateGameMessage(bot, currentGameSession);
      bot.answerCallbackQuery(query.id, { 
        text: isMain ? 'Вы записаны!' : 'Вы добавлены в резерв!' 
      });
      break;

    case 'register_reserve':
      const reserveGameSession = gameSessions.get(chatId);
      if (reserveGameSession.players.find(p => p.userId === userId) || 
          reserveGameSession.reserve.find(p => p.userId === userId)) {
        bot.answerCallbackQuery(query.id, { text: 'Вы уже записаны!' });
        return;
      }

      reserveGameSession.reserve.push({ userId, username, firstName, lastName });
      await updateGameMessage(bot, reserveGameSession);
      bot.answerCallbackQuery(query.id, { text: 'Вы добавлены в резерв!' });
      break;

    case 'unregister':
      const unregisterGameSession = gameSessions.get(chatId);
      const removed = unregisterGameSession.removePlayer(userId);
      if (removed) {
        await updateGameMessage(bot, unregisterGameSession);
        bot.answerCallbackQuery(query.id, { text: 'Запись отменена!' });
      } else {
        bot.answerCallbackQuery(query.id, { text: 'Вы не были записаны!' });
      }
      break;

    

    case 'enter_friend_name':
      userStates.set(userId, UserState.ENTERING_FRIEND_NAME);
      bot.deleteMessage(chatId, query.message.message_id);
      bot.sendMessage(chatId, 
        'Введите имя друга:',
        { reply_markup: { keyboard: [['Отмена']], resize_keyboard: true } }
      );
      bot.answerCallbackQuery(query.id);
      break;



















    default:
      break;
  }
}

// Обновление сообщения игры
async function updateGameMessage(bot, gameSession) {
  try {
    const message = gameSession.generateMessage();
    const keyboard = gameSession.generateKeyboard();
    
    await bot.editMessageText(message, {
      chat_id: gameSession.chatId,
      message_id: gameSession.messageId,
      parse_mode: 'HTML',
      reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined
    });
  } catch (error) {
    console.error('Ошибка обновления сообщения:', error);
  }
}

module.exports = {
  UserState,
  handleStart,
  handleCreateGame,
  handleEndGame,
  handleMessage,
  handleCallbackQuery,
  updateGameMessage
};
