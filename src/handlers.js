const GameSession = require('./GameSession');

// Функция для восстановления состояния из текста сообщения
async function restoreStateFromMessage(bot, msg, gameSessions, userStates) {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  if (!text) return false;
  
  // Пытаемся восстановить состояние из текста
  const gameSession = GameSession.parseFromMessage(text, chatId, msg.message_id);
  
  if (gameSession) {
    gameSessions.set(chatId, gameSession);
    console.log(`Состояние восстановлено из сообщения для chatId: ${chatId}`);
    return true;
  }
  
  return false;
}

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
      '🤝 <b>Управление игроками:</b>\n' +
      '• Добавить игрока: + Имя\n' +
      '• Удалить игрока: - Имя\n' +
      '• Любой может добавлять/удалять любых игроков', 
      { parse_mode: 'HTML' }
    );
  }
}

// Команда создания игры (только для админа)
async function handleCreateGame(bot, msg, gameSessions, userStates, playersLimit, gameDescription) {
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
  
  const gameSession = new GameSession(chatId, gameMessage.message_id, playersLimit, true, gameDescription);
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
async function handleMessage(bot, msg, gameSessions, userStates) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;

  // Пытаемся восстановить состояние из текста сообщения
  const restored = await restoreStateFromMessage(bot, msg, gameSessions, userStates);
  if (restored) {
    console.log(`Состояние восстановлено из текстового сообщения для chatId: ${chatId}`);
    return;
  }

  // Обработка команд для добавления/удаления игроков
  const addPlayerMatch = text.match(/^\+\s+(.+)$/);
  const removePlayerMatch = text.match(/^\-\s+(.+)$/);

  if (addPlayerMatch) {
    const playerName = addPlayerMatch[1].trim();
    if (playerName.length === 0) {
      bot.sendMessage(chatId, 'Пожалуйста, укажите имя игрока.');
      return;
    }

    // Получаем активную игру
    const gameSession = gameSessions.get(chatId);
    if (!gameSession || !gameSession.isActive) {
      bot.sendMessage(chatId, 'Нет активной игры для записи.');
      return;
    }

    // Проверяем, не добавлен ли уже такой игрок
    const existingPlayer = gameSession.players.find(p => 
      p.firstName && p.firstName.toLowerCase() === playerName.toLowerCase()
    ) || gameSession.reserve.find(p => 
      p.firstName && p.firstName.toLowerCase() === playerName.toLowerCase()
    );

    if (existingPlayer) {
      bot.sendMessage(chatId, `Игрок "${playerName}" уже записан на игру.`);
      return;
    }

    // Создаем нового игрока-друга
    const newPlayer = {
      userId: `friend_${Date.now()}_${playerName}`,
      username: null,
      firstName: playerName,
      lastName: null,
      isFriend: true,
      addedBy: userId
    };

    // Добавляем в основной список или резерв
    if (gameSession.players.length < gameSession.playersLimit) {
      gameSession.players.push(newPlayer);
      bot.sendMessage(chatId, `✅ Игрок "${playerName}" добавлен в основной состав!`);
    } else {
      gameSession.reserve.push(newPlayer);
      bot.sendMessage(chatId, `✅ Игрок "${playerName}" добавлен в резерв!`);
    }

    // Обновляем сообщение игры
    await updateGameMessage(bot, gameSession);
    return;
  }

  if (removePlayerMatch) {
    const playerName = removePlayerMatch[1].trim();
    if (playerName.length === 0) {
      bot.sendMessage(chatId, 'Пожалуйста, укажите имя игрока для удаления.');
      return;
    }

    // Получаем активную игру
    const gameSession = gameSessions.get(chatId);
    if (!gameSession || !gameSession.isActive) {
      bot.sendMessage(chatId, 'Нет активной игры для изменения.');
      return;
    }

    // Ищем игрока в основном составе
    let playerIndex = gameSession.players.findIndex(p => 
      p.firstName && p.firstName.toLowerCase() === playerName.toLowerCase()
    );
    let isMainPlayer = true;

    // Если не найден в основном составе, ищем в резерве
    if (playerIndex === -1) {
      playerIndex = gameSession.reserve.findIndex(p => 
        p.firstName && p.firstName.toLowerCase() === playerName.toLowerCase()
      );
      isMainPlayer = false;
    }

    if (playerIndex === -1) {
      bot.sendMessage(chatId, `Игрок "${playerName}" не найден в списке.`);
      return;
    }

    // Удаляем игрока
    if (isMainPlayer) {
      gameSession.players.splice(playerIndex, 1);
      
      // Перемещаем первого из резерва, если есть место
      if (gameSession.reserve.length > 0) {
        const reservePlayer = gameSession.reserve.shift();
        gameSession.players.push(reservePlayer);
      }
      
      bot.sendMessage(chatId, `❌ Игрок "${playerName}" удален из основного состава!`);
    } else {
      gameSession.reserve.splice(playerIndex, 1);
      bot.sendMessage(chatId, `❌ Игрок "${playerName}" удален из резерва!`);
    }

    // Обновляем сообщение игры
    await updateGameMessage(bot, gameSession);
    return;
  }

  // Обычные текстовые сообщения не обрабатываются
  // Все команды обрабатываются через bot.onText
}

// Обработка callback запросов
async function handleCallbackQuery(bot, query, gameSessions, userStates, adminId) {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;
  const messageId = query.message.message_id;
  const messageText = query.message.text;

  // Проверяем права администратора для завершения игры
  if (data === 'end_game') {
    if (userId !== adminId) {
      bot.answerCallbackQuery(query.id, { text: 'У вас нет прав для завершения игры.' });
      return;
    }
  } else {
    let gameSession = gameSessions.get(chatId);
    
    // Если состояние не найдено, пытаемся восстановить из текста сообщения
    if (!gameSession && messageText) {
      gameSession = GameSession.parseFromMessage(messageText, chatId, messageId);
      if (gameSession) {
        gameSessions.set(chatId, gameSession);
        console.log(`Состояние восстановлено из callback для chatId: ${chatId}`);
      }
    }
    
    if (!gameSession) {
      bot.answerCallbackQuery(query.id, { text: 'Игра не найдена.' });
      return;
    }
    
    // Проверяем, что игра активна (кроме команды end_game)
    if (data !== 'end_game' && !gameSession.isActive) {
      bot.answerCallbackQuery(query.id, { text: 'Игра уже завершена.' });
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

    case 'refresh_state':
      // Восстанавливаем состояние из текста сообщения
      if (messageText) {
        const restoredGameSession = GameSession.parseFromMessage(messageText, chatId, messageId);
        if (restoredGameSession) {
          gameSessions.set(chatId, restoredGameSession);
          console.log(`Состояние восстановлено по кнопке "Обновить" для chatId: ${chatId}`);
          
          // Обновляем сообщение с восстановленным состоянием
          await updateGameMessage(bot, restoredGameSession);
          bot.answerCallbackQuery(query.id, { text: 'Состояние обновлено!' });
        } else {
          bot.answerCallbackQuery(query.id, { text: 'Не удалось восстановить состояние.' });
        }
      } else {
        bot.answerCallbackQuery(query.id, { text: 'Текст сообщения не найден.' });
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
    
    console.log(`Обновление сообщения игры: chatId=${gameSession.chatId}, lastMessageId=${gameSession.lastMessageId}`);
    console.log(`Сообщение: ${message.substring(0, 100)}...`);
    console.log(`Клавиатура: ${JSON.stringify(keyboard)}`);
    
    // Проверяем, есть ли изменения в сообщении
    try {
      await bot.editMessageText(message, {
        chat_id: gameSession.chatId,
        message_id: gameSession.lastMessageId, // Обновляем последнее сообщение
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
  updateGameMessage,
  restoreStateFromMessage
};
