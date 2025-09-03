class GameSession {
  constructor(chatId, messageId, playersLimit = 10, isAdmin = false, gameDescription = '') {
    this.chatId = chatId;
    this.messageId = messageId; // ID основного сообщения
    this.lastMessageId = messageId; // ID последнего сообщения (для обновления)
    this.playersLimit = playersLimit;
    this.players = []; // [{userId, username, firstName, lastName}]
    this.reserve = []; // [{userId, username, firstName, lastName}]
    this.isActive = true;
    this.isAdmin = isAdmin;
    this.gameDescription = gameDescription;
  }

  addPlayer(userId, username, firstName, lastName) {
    if (this.players.length < this.playersLimit) {
      this.players.push({ userId, username, firstName, lastName });
      return true;
    } else {
      this.reserve.push({ userId, username, firstName, lastName });
      return false;
    }
  }

  removePlayer(userId) {
    // Удаляем из основных игроков
    const playerIndex = this.players.findIndex(p => p.userId === userId);
    if (playerIndex !== -1) {
      this.players.splice(playerIndex, 1);
      
      // Перемещаем первого из резерва
      if (this.reserve.length > 0) {
        const reservePlayer = this.reserve.shift();
        this.players.push(reservePlayer);
      }
      
      return true;
    }

    // Удаляем из резерва
    const reserveIndex = this.reserve.findIndex(p => p.userId === userId);
    if (reserveIndex !== -1) {
      this.reserve.splice(reserveIndex, 1);
      return true;
    }

    return false;
  }




  generateMessage() {
    let message = `⚽ <b>Запись на игру</b>\n\n`;
    
    if (this.gameDescription) {
      message += `📝 <b>Описание:</b>\n${this.gameDescription}\n\n`;
    }
    
    message += `👥 <b>Список игроков:</b>\n`;
    
    // Создаем нумерованный список с пустыми местами
    for (let i = 1; i <= this.playersLimit; i++) {
      const player = this.players[i - 1];
      if (player) {
        if (player.isFriend) {
          message += `${i}. ${player.firstName} (добавлен другим юзером)\n`;
        } else {
          message += `${i}. ${player.firstName || player.username || `User${player.userId}`} (id:${player.userId})\n`;
        }
      } else {
        message += `${i}.\n`;
      }
    }
    
    // Добавляем резерв, если есть
    if (this.reserve.length > 0) {
      message += `\n⏳ <b>Резерв:</b>\n`;
      this.reserve.forEach((player, index) => {
        if (player.isFriend) {
          message += `${index + 1}. ${player.firstName} (добавлен другим юзером)\n`;
        } else {
          message += `${index + 1}. ${player.firstName || player.username || `User${player.userId}`} (id:${player.userId})\n`;
        }
      });
    }

    // Добавляем объяснение по управлению игроками
    message += `\nДля дополнительного управления записями напишите в ответном сообщении НА ЭТОТ ПОСТ:\n\n`;
    message += `• Для записи друга: + Имя (например: + Иван)\n`;
    message += `• Для удаления друга: - Имя (например: - Иван)\n`;
    message += `• Для удаления своей записи: -\n`;

    return message;
  }



  // Метод для обновления последнего сообщения
  updateLastMessage(messageId) {
    this.lastMessageId = messageId;
  }

  // Метод для удаления предыдущего сообщения
  async deletePreviousMessage(bot) {
    if (this.lastMessageId !== this.messageId) {
      try {
        await bot.deleteMessage(this.chatId, this.lastMessageId);
        console.log(`Удалено предыдущее сообщение: ${this.lastMessageId}`);
      } catch (error) {
        console.log(`Ошибка удаления предыдущего сообщения: ${error.message}`);
      }
    }
  }

  generateKeyboard() {
    const keyboard = [];
    
    if (this.isActive) {
      // Основная клавиатура
      keyboard.push([
        { text: '✅ Записаться', callback_data: 'register' }
      ]);
      
      if (this.players.length >= this.playersLimit) {
        keyboard.push([
          { text: '⏳ Записаться в резерв', callback_data: 'register_reserve' }
        ]);
      }

      // Кнопка для обновления состояния игры
      keyboard.push([
        { text: '🔄 Обновить', callback_data: 'refresh_state' }
      ]);

      // Кнопки администратора (только для админов)
      // Кнопка "Завершить игру" удалена
    }

    return keyboard;
  }

  // Метод для парсинга состояния из текста сообщения
  static parseFromMessage(text, chatId, messageId) {
    try {
      // Проверяем, что это сообщение о записи на игру
      if (!text.includes('⚽ Запись на игру')) {
        return null;
      }

      // Извлекаем описание игры
      let gameDescription = '';
      const descriptionMatch = text.match(/📝 Описание:\n([^\n]+)/);
      if (descriptionMatch) {
        gameDescription = descriptionMatch[1];
      }

      // Извлекаем лимит игроков из списка
      const playersListMatch = text.match(/👥 Список игроков:\n([\s\S]*?)(?=\n\n⏳ Резерв:|\n\n• Для добавления игрока|$)/);
      if (!playersListMatch) {
        return null;
      }

      const playersList = playersListMatch[1];
      const playerLines = playersList.split('\n').filter(line => line.trim());
      
      // Определяем лимит игроков - считаем только строки с номерами (1., 2., 3., etc.)
      // Исключаем строки с инструкциями (начинающиеся с •)
      const numberedLines = playerLines.filter(line => /^\d+\./.test(line));
      const playersLimit = numberedLines.length;

      // Парсим основных игроков - только строки с номерами
      const players = [];
      for (const line of numberedLines) {
        // Парсим строку с учетом userId в скобках - требуем наличие символов после точки
        const match = line.match(/^\d+\.\s+(.+?)(?:\s+\(добавлен другим юзером\)|\s+\(id:(\d+)\))?$/);
        
        if (match && match[1] && match[1].trim() !== '') {
          const playerName = match[1].trim();
          
          const isFriend = line.includes('(добавлен другим юзером)');
          const userId = match[2]; // userId может быть во 2-й группе
          
          if (isFriend) {
            // Это игрок, добавленный пользователем
            players.push({
              userId: `friend_${Date.now()}_${playerName}`,
              username: null,
              firstName: playerName,
              lastName: null,
              isFriend: true
            });
          } else if (userId) {
            // Это обычный игрок с userId
            players.push({
              userId: parseInt(userId), // Преобразуем в число
              username: null,
              firstName: playerName,
              lastName: null
            });
          } else {
            // Fallback для старых сообщений без userId
            players.push({
              userId: `restored_${Date.now()}_${playerName}`,
              username: null,
              firstName: playerName,
              lastName: null
            });
          }
        }
        // Если match[1] пустой или содержит только пробелы, игрок не добавляется
      }

      // Парсим резерв
      const reserve = [];
      const reserveMatch = text.match(/⏳ Резерв:\n([\s\S]*?)(?=\n\n• Для добавления игрока|$)/);
      if (reserveMatch) {
        const reserveList = reserveMatch[1];
        const reserveLines = reserveList.split('\n').filter(line => line.trim());
        
        for (const line of reserveLines) {
          // Парсим строку с учетом userId в скобках - требуем наличие символов после точки
          const match = line.match(/^\d+\.\s+(.+?)(?:\s+\(добавлен другим юзером\)|\s+\(id:(\d+)\))?$/);
          if (match && match[1] && match[1].trim() !== '') {
            const playerName = match[1].trim();
            const isFriend = line.includes('(добавлен другим юзером)');
            const userId = match[2]; // userId может быть во 2-й группе
            
            if (isFriend) {
              // Это игрок в резерве, добавленный пользователем
              reserve.push({
                userId: `friend_reserve_${Date.now()}_${playerName}`,
                username: null,
                firstName: playerName,
                lastName: null,
                isFriend: true
              });
            } else if (userId) {
              // Это обычный игрок в резерве с userId
              reserve.push({
                userId: parseInt(userId), // Преобразуем в число
                username: null,
                firstName: playerName,
                lastName: null
              });
            } else {
              // Fallback для старых сообщений без userId
              reserve.push({
                userId: `reserve_${Date.now()}_${playerName}`,
                username: null,
                firstName: playerName,
                lastName: null
              });
            }
          }
          // Если match[1] пустой или содержит только пробелы, игрок не добавляется
        }
      }

      // Определяем, активна ли игра
      const isActive = !text.includes('🔚 Завершить игру') || text.includes('✅ Записаться');

      // Создаем новый GameSession
      const gameSession = new GameSession(chatId, messageId, playersLimit, true, gameDescription);
      gameSession.players = players;
      gameSession.reserve = reserve;
      gameSession.isActive = isActive;
      gameSession.lastMessageId = messageId;

      return gameSession;
    } catch (error) {
      console.error('Ошибка парсинга сообщения:', error);
      return null;
    }
  }

  // Метод для получения текста сообщения для восстановления
  getRestoreText() {
    return this.generateMessage();
  }

}

module.exports = GameSession;
