const GameSession = require('./GameSession');

// Обработка команды /start
function handleStart(bot, msg, gameSessions, userStates, adminId) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const GROUP_ID = process.env.GROUP_ID ? parseInt(process.env.GROUP_ID) : null;
  
  if (GROUP_ID && chatId !== GROUP_ID) {
    bot.sendMessage(chatId, 'Этот бот работает только в определенной группе.');
    return;
  }

  if (userId === adminId) {
    bot.sendMessage(chatId, 
      'Привет! Ты администратор. Используй /start <количество> <описание> для создания записи на игру.\n\nПример: /start 10 Футбол в 18:00'
    );
  } else {
    bot.sendMessage(chatId, 
      'Привет! Ожидай создания записи на игру от администратора.\n\n' +
      '🤝 <b>Управление друзьями:</b>\n' +
      '• Добавить друга: + Имя\n' +
      '• Удалить друга: - Имя\n' +
      '• Посмотреть список: /friends', 
      { parse_mode: 'HTML' }
    );
  }
}

// Команда создания игры (только для админа)
async function handleCreateGame(bot, msg, gameSessions, userStates, playersLimit, gameDescription, friends) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const GROUP_ID = process.env.GROUP_ID ? parseInt(process.env.GROUP_ID) : null;

  console.log(`Создание игры: chatId=${chatId}, playersLimit=${playersLimit}, description="${gameDescription}"`);

  if (GROUP_ID && chatId !== GROUP_ID) {
    bot.sendMessage(chatId, 'Игры можно создавать только в определенной группе.');
    return;
  }

  // Создаем пустое сообщение и сразу заменяем его содержимым игры
  const gameMessage = await bot.sendMessage(chatId, '⚽ Запись на игру');
  console.log(`Создано временное сообщение: messageId=${gameMessage.message_id}`);
  
  const gameSession = new GameSession(chatId, gameMessage.message_id, playersLimit, true, gameDescription, friends);
  gameSessions.set(chatId, gameSession);
  
  console.log(`GameSession создан, обновляем сообщение...`);
  await updateGameMessage(bot, gameSession);
  console.log(`Игра создана успешно`);
}

// Команда завершения игры (только для админа)
function handleEndGame(bot, msg, gameSessions, userStates) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

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
async function handleMessage(bot, msg, gameSessions, userStates, friends) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;

  // Обработка команд для друзей
  const addFriendMatch = text.match(/^\+\s+(.+)$/);
  const removeFriendMatch = text.match(/^\-\s+(.+)$/);

  if (addFriendMatch) {
    const friendName = addFriendMatch[1].trim();
    if (friendName.length === 0) {
      bot.sendMessage(chatId, 'Пожалуйста, укажите имя друга.');
      return;
    }

    // Инициализируем массив друзей для пользователя, если его нет
    if (!friends.has(userId)) {
      friends.set(userId, []);
    }

    const userFriends = friends.get(userId);
    
    // Проверяем, не добавлен ли уже такой друг
    if (userFriends.find(f => f.name.toLowerCase() === friendName.toLowerCase())) {
      bot.sendMessage(chatId, `Друг "${friendName}" уже добавлен в ваш список.`);
      return;
    }

    // Добавляем друга
    userFriends.push({
      name: friendName,
      addedBy: userId
    });

    bot.sendMessage(chatId, `✅ Друг "${friendName}" добавлен в ваш список!`);
    
    // Обновляем сообщение игры, если есть активная игра
    const gameSession = gameSessions.get(chatId);
    if (gameSession && gameSession.isActive) {
      try {
        // Добавляем всех друзей в список игроков
        gameSession.addFriendsToPlayers(friends);
        
        // Отправляем новое сообщение с обновленным списком
        const message = gameSession.generateMessage();
        const keyboard = gameSession.generateKeyboard();
        
        await bot.sendMessage(chatId, message, {
          parse_mode: 'HTML',
          reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined
        });
        
        console.log('Отправлено новое сообщение с обновленным списком друзей');
      } catch (error) {
        console.log('Ошибка отправки нового сообщения:', error.message);
      }
    }
    return;
  }

  if (removeFriendMatch) {
    const friendName = removeFriendMatch[1].trim();
    if (friendName.length === 0) {
      bot.sendMessage(chatId, 'Пожалуйста, укажите имя друга для удаления.');
      return;
    }

    if (!friends.has(userId)) {
      bot.sendMessage(chatId, 'У вас нет списка друзей.');
      return;
    }

    const userFriends = friends.get(userId);
    const friendIndex = userFriends.findIndex(f => f.name.toLowerCase() === friendName.toLowerCase());
    
    if (friendIndex === -1) {
      bot.sendMessage(chatId, `Друг "${friendName}" не найден в вашем списке.`);
      return;
    }

    // Удаляем друга
    userFriends.splice(friendIndex, 1);
    bot.sendMessage(chatId, `❌ Друг "${friendName}" удален из вашего списка.`);
    
    // Обновляем сообщение игры, если есть активная игра
    const gameSession = gameSessions.get(chatId);
    if (gameSession && gameSession.isActive) {
      try {
        // Удаляем всех друзей из списка игроков и добавляем заново
        gameSession.removeFriendsOfPlayer(userId);
        gameSession.addFriendsToPlayers(friends);
        
        // Отправляем новое сообщение с обновленным списком
        const message = gameSession.generateMessage();
        const keyboard = gameSession.generateKeyboard();
        
        await bot.sendMessage(chatId, message, {
          parse_mode: 'HTML',
          reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined
        });
        
        console.log('Отправлено новое сообщение с обновленным списком друзей');
      } catch (error) {
        console.log('Ошибка отправки нового сообщения:', error.message);
      }
    }
    return;
  }

  // Обычные текстовые сообщения не обрабатываются
  // Все команды обрабатываются через bot.onText
}

// Обработка callback запросов
async function handleCallbackQuery(bot, query, gameSessions, userStates, adminId, friends) {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;
  const messageId = query.message.message_id;

  // Проверяем права администратора для завершения игры
  if (data === 'end_game') {
    if (userId !== adminId) {
      bot.answerCallbackQuery(query.id, { text: 'У вас нет прав для завершения игры.' });
      return;
    }
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
      
      // Добавляем друзей этого пользователя в список игроков
      if (reserveGameSession.friends && reserveGameSession.friends.has(userId)) {
        reserveGameSession.addFriendsToPlayers(reserveGameSession.friends);
      }
      
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

    case 'end_game':
      const endGameSession = gameSessions.get(chatId);
      if (endGameSession) {
        endGameSession.isActive = false;
        await updateGameMessage(bot, endGameSession);
        bot.answerCallbackQuery(query.id, { text: 'Игра завершена!' });
      } else {
        bot.answerCallbackQuery(query.id, { text: 'Игра не найдена.' });
      }
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
    
    console.log(`Обновление сообщения игры: chatId=${gameSession.chatId}, messageId=${gameSession.messageId}`);
    console.log(`Сообщение: ${message.substring(0, 100)}...`);
    console.log(`Клавиатура: ${JSON.stringify(keyboard)}`);
    
    // Проверяем, есть ли изменения в сообщении
    try {
      await bot.editMessageText(message, {
        chat_id: gameSession.chatId,
        message_id: gameSession.messageId,
        parse_mode: 'HTML',
        reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined
      });
      console.log('Сообщение успешно обновлено');
    } catch (editError) {
      if (editError.response && editError.response.statusCode === 400 && 
          editError.response.body && editError.response.body.description === 'message is not modified') {
        console.log('Сообщение не изменилось, обновление не требуется');
      } else {
        throw editError; // Перебрасываем другие ошибки
      }
    }
  } catch (error) {
    console.error('Ошибка обновления сообщения:', error);
    console.error('Детали ошибки:', error.response?.data || error.message);
  }
}

module.exports = {
  handleStart,
  handleCreateGame,
  handleEndGame,
  handleMessage,
  handleCallbackQuery,
  updateGameMessage
};
