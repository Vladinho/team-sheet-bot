const GameSession = require('./GameSession');

// Состояния пользователя
const UserState = {
  IDLE: 'idle',
  CREATING_GAME: 'creating_game',
  ENTERING_PLAYERS_LIMIT: 'entering_players_limit',
  ENTERING_FRIEND_NAME: 'entering_friend_name'
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
  
  bot.sendMessage(chatId, 
    'Создание записи на игру. Введите количество мест (по умолчанию 10):',
    { reply_markup: { keyboard: [['10 (по умолчанию)', 'Отмена']], resize_keyboard: true } }
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
  bot.sendMessage(chatId, 'Игра завершена! Запись закрыта.');
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
      bot.sendMessage(chatId, 'Создание игры отменено.', { reply_markup: { remove_keyboard: true } });
      return;
    }

    let playersLimit = 10;
    if (text !== '10 (по умолчанию)') {
      const limit = parseInt(text);
      if (isNaN(limit) || limit <= 0) {
        bot.sendMessage(chatId, 'Пожалуйста, введите корректное число мест.');
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
    
    bot.sendMessage(chatId, 'Игра создана!', { reply_markup: { remove_keyboard: true } });
  }
  
  else if (state === UserState.ENTERING_FRIEND_NAME) {
    const gameSession = gameSessions.get(chatId);
    if (!gameSession) {
      userStates.delete(userId);
      bot.sendMessage(chatId, 'Игра не найдена.', { reply_markup: { remove_keyboard: true } });
      return;
    }

    if (text === 'Отмена') {
      userStates.delete(userId);
      bot.sendMessage(chatId, 'Добавление друга отменено.', { reply_markup: { remove_keyboard: true } });
      return;
    }

    const success = gameSession.addFriend(userId, text, userId);
    if (success) {
      await updateGameMessage(bot, gameSession);
      bot.sendMessage(chatId, `Друг "${text}" добавлен!`, { reply_markup: { remove_keyboard: true } });
    } else {
      const maxFriends = userId === parseInt(process.env.ADMIN_ID) ? 'неограниченно' : '2';
      bot.sendMessage(chatId, `Нельзя добавить больше друзей (максимум ${maxFriends}).`);
    }
    
    userStates.delete(userId);
  }
}

// Обработка callback запросов
async function handleCallbackQuery(bot, query, gameSessions, userStates) {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;
  const messageId = query.message.message_id;

  const gameSession = gameSessions.get(chatId);
  if (!gameSession || gameSession.messageId !== messageId) {
    bot.answerCallbackQuery(query.id, { text: 'Игра не найдена или устарела.' });
    return;
  }

  const username = query.from.username;
  const firstName = query.from.first_name;
  const lastName = query.from.last_name;

  switch (data) {
    case 'register':
      if (gameSession.players.find(p => p.userId === userId) || 
          gameSession.reserve.find(p => p.userId === userId)) {
        bot.answerCallbackQuery(query.id, { text: 'Вы уже записаны!' });
        return;
      }

      const isMain = gameSession.addPlayer(userId, username, firstName, lastName);
      await updateGameMessage(bot, gameSession);
      bot.answerCallbackQuery(query.id, { 
        text: isMain ? 'Вы записаны!' : 'Вы добавлены в резерв!' 
      });
      break;

    case 'register_reserve':
      if (gameSession.players.find(p => p.userId === userId) || 
          gameSession.reserve.find(p => p.userId === userId)) {
        bot.answerCallbackQuery(query.id, { text: 'Вы уже записаны!' });
        return;
      }

      gameSession.reserve.push({ userId, username, firstName, lastName });
      await updateGameMessage(bot, gameSession);
      bot.answerCallbackQuery(query.id, { text: 'Вы добавлены в резерв!' });
      break;

    case 'unregister':
      const removed = gameSession.removePlayer(userId);
      if (removed) {
        await updateGameMessage(bot, gameSession);
        bot.answerCallbackQuery(query.id, { text: 'Запись отменена!' });
      } else {
        bot.answerCallbackQuery(query.id, { text: 'Вы не были записаны!' });
      }
      break;

    case 'add_friend':
      userStates.set(userId, UserState.ENTERING_FRIEND_NAME);
      bot.sendMessage(chatId, 
        'Введите имя друга:',
        { reply_markup: { keyboard: [['Отмена']], resize_keyboard: true } }
      );
      bot.answerCallbackQuery(query.id);
      break;

    case 'remove_friend':
      const friends = gameSession.getFriendsList(userId);
      if (friends.length === 0) {
        bot.answerCallbackQuery(query.id, { text: 'У вас нет записанных друзей!' });
        return;
      }

      const keyboard = friends.map(friend => [{ text: `🗑 ${friend.name}`, callback_data: `remove_friend_${friend.name}` }]);
      keyboard.push([{ text: 'Отмена', callback_data: 'cancel_remove_friend' }]);
      
      bot.sendMessage(chatId, 
        'Выберите друга для удаления:',
        { reply_markup: { inline_keyboard: keyboard } }
      );
      bot.answerCallbackQuery(query.id);
      break;

    case 'cancel_remove_friend':
      bot.deleteMessage(chatId, query.message.message_id);
      bot.answerCallbackQuery(query.id);
      break;

    default:
      if (data.startsWith('remove_friend_')) {
        const friendName = data.replace('remove_friend_', '');
        const removed = gameSession.removeFriend(userId, friendName);
        
        if (removed) {
          await updateGameMessage(bot, gameSession);
          bot.answerCallbackQuery(query.id, { text: `Друг "${friendName}" удален!` });
        } else {
          bot.answerCallbackQuery(query.id, { text: 'Друг не найден!' });
        }
        
        bot.deleteMessage(chatId, query.message.message_id);
      }
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
