class GameSession {
  constructor(chatId, messageId, playersLimit = 10, isAdmin = false, gameDescription = '', friends = null) {
    this.chatId = chatId;
    this.messageId = messageId; // ID основного сообщения
    this.lastMessageId = messageId; // ID последнего сообщения (для обновления)
    this.playersLimit = playersLimit;
    this.players = []; // [{userId, username, firstName, lastName}]
    this.reserve = []; // [{userId, username, firstName, lastName}]
    this.isActive = true;
    this.isAdmin = isAdmin;
    this.gameDescription = gameDescription;
    this.friends = friends; // Map для хранения друзей
  }

  addPlayer(userId, username, firstName, lastName) {
    if (this.players.length < this.playersLimit) {
      this.players.push({ userId, username, firstName, lastName });
      
      // Добавляем друзей этого игрока
      if (this.friends && this.friends.has(userId)) {
        this.addFriendsToPlayers(this.friends);
      }
      
      return true;
    } else {
      this.reserve.push({ userId, username, firstName, lastName });
      
      // Добавляем друзей этого игрока
      if (this.friends && this.friends.has(userId)) {
        this.addFriendsToPlayers(this.friends);
      }
      
      return false;
    }
  }

  removePlayer(userId) {
    // Удаляем из основных игроков
    const playerIndex = this.players.findIndex(p => p.userId === userId);
    if (playerIndex !== -1) {
      this.players.splice(playerIndex, 1);
      
      // Удаляем друзей этого игрока
      this.removeFriendsOfPlayer(userId);
      
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
      
      // Удаляем друзей этого игрока
      this.removeFriendsOfPlayer(userId);
      
      return true;
    }

    return false;
  }

  // Добавляем друзей в список игроков
  addFriendsToPlayers(friends) {
    if (!friends || friends.size === 0) return;
    
    for (const [userId, userFriends] of friends) {
      if (userFriends.length > 0) {
        // Получаем имя пользователя (если он записан) или используем ID
        let playerName = `User${userId}`;
        const player = this.players.find(p => p.userId === userId) || 
                      this.reserve.find(p => p.userId === userId);
        
        if (player) {
          playerName = player.firstName || player.username || `User${userId}`;
        }
        
        for (const friend of userFriends) {
          // Проверяем, не добавлен ли уже такой друг
          const existingFriend = this.players.find(p => 
            p.friendOf === userId && p.firstName === friend.name
          ) || this.reserve.find(p => 
            p.friendOf === userId && p.firstName === friend.name
          );
          
          if (!existingFriend) {
            const friendPlayer = {
              userId: `friend_${userId}_${friend.name}`,
              username: null,
              firstName: friend.name,
              lastName: null,
              friendOf: userId,
              isFriend: true
            };
            
            if (this.players.length < this.playersLimit) {
              this.players.push(friendPlayer);
            } else {
              this.reserve.push(friendPlayer);
            }
          }
        }
      }
    }
  }

  // Удаляем друзей при удалении основного игрока
  removeFriendsOfPlayer(userId) {
    // Удаляем друзей из основных игроков
    this.players = this.players.filter(p => p.friendOf !== userId);
    
    // Удаляем друзей из резерва
    this.reserve = this.reserve.filter(p => p.friendOf !== userId);
    
    // Перемещаем игроков из резерва, если есть место
    while (this.players.length < this.playersLimit && this.reserve.length > 0) {
      const reservePlayer = this.reserve.shift();
      this.players.push(reservePlayer);
    }
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
          // Для друзей используем сохраненное имя основного игрока
          const mainPlayerName = typeof player.friendOf === 'string' && !player.friendOf.startsWith('User') 
            ? player.friendOf 
            : this.getPlayerNameById(player.friendOf);
          message += `${i}. ${player.firstName} (друг ${mainPlayerName}, id:${player.userId})\n`;
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
          // Для друзей используем сохраненное имя основного игрока
          const mainPlayerName = typeof player.friendOf === 'string' && !player.friendOf.startsWith('User') 
            ? player.friendOf 
            : this.getPlayerNameById(player.friendOf);
          message += `${index + 1}. ${player.firstName} (друг ${mainPlayerName}, id:${player.userId})\n`;
        } else {
          message += `${index + 1}. ${player.firstName || player.username || `User${player.userId}`} (id:${player.userId})\n`;
        }
      });
    }

    // Добавляем объяснение по управлению друзьями
    message += `• Для записи друга в ответном сообщении: + Имя (например: + Иван)\n`;
    message += `• Для удаления друга: - Имя (например: - Иван)\n`;
    return message;
  }

  // Вспомогательный метод для получения имени игрока по ID
  getPlayerNameById(userId) {
    const player = this.players.find(p => p.userId === userId) || 
                  this.reserve.find(p => p.userId === userId);
    
    if (player) {
      return player.firstName || player.username || `User${userId}`;
    }
    
    // Если это восстановленное состояние, пытаемся найти по имени
    if (typeof userId === 'string' && userId.startsWith('User')) {
      const nameMatch = userId.match(/User(.+)/);
      if (nameMatch) {
        return nameMatch[1];
      }
    }
    
    // Если userId - это число, возвращаем его как есть
    if (typeof userId === 'number' || !isNaN(userId)) {
      return `User${userId}`;
    }
    
    return `User${userId}`;
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
        { text: '✅ Записаться', callback_data: 'register' },
        { text: '❌ Отменить запись', callback_data: 'unregister' }
      ]);
      
      if (this.players.length >= this.playersLimit) {
        keyboard.push([
          { text: '⏳ Записаться в резерв', callback_data: 'register_reserve' }
        ]);
      }

      // Кнопки администратора (только для админов)
      if (this.isAdmin) {
        keyboard.push([
          { text: '🔚 Завершить игру', callback_data: 'end_game' }
        ]);
      }
    }

    return keyboard;
  }

  // Метод для парсинга состояния из текста сообщения
  static parseFromMessage(text, chatId, messageId, friends = null) {
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
      const playersListMatch = text.match(/👥 Список игроков:\n([\s\S]*?)(?=\n\n⏳ Резерв:|\n\n• Для записи друга|$)/);
      if (!playersListMatch) {
        return null;
      }

      const playersList = playersListMatch[1];
      const playerLines = playersList.split('\n').filter(line => line.trim());
      
      // Определяем лимит игроков по количеству строк
      const playersLimit = playerLines.length;

      // Парсим основных игроков
      const players = [];
      for (const line of playerLines) {
        // Парсим строку с учетом userId в скобках
        const match = line.match(/^\d+\.\s+(.+?)(?:\s+\(друг\s+(.+?),\s*id:(\d+)\)|\s+\(id:(\d+)\))?$/);
        if (match) {
          const playerName = match[1].trim();
          const friendOf = match[2];
          const userId = match[3] || match[4]; // userId может быть в 3-й или 4-й группе
          
          if (playerName && playerName !== '') {
            if (friendOf && userId) {
              // Это друг с userId
              players.push({
                userId: parseInt(userId), // Преобразуем в число
                username: null,
                firstName: playerName,
                lastName: null,
                friendOf: friendOf, // Сохраняем имя основного игрока
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
              if (friendOf) {
                players.push({
                  userId: `friend_${Date.now()}_${playerName}`,
                  username: null,
                  firstName: playerName,
                  lastName: null,
                  friendOf: friendOf,
                  isFriend: true
                });
              } else {
                players.push({
                  userId: `restored_${Date.now()}_${playerName}`,
                  username: null,
                  firstName: playerName,
                  lastName: null
                });
              }
            }
          }
        }
      }

      // Парсим резерв
      const reserve = [];
      const reserveMatch = text.match(/⏳ Резерв:\n([\s\S]*?)(?=\n\n• Для записи друга|$)/);
      if (reserveMatch) {
        const reserveList = reserveMatch[1];
        const reserveLines = reserveList.split('\n').filter(line => line.trim());
        
        for (const line of reserveLines) {
          // Парсим строку с учетом userId в скобках
          const match = line.match(/^\d+\.\s+(.+?)(?:\s+\(друг\s+(.+?),\s*id:(\d+)\)|\s+\(id:(\d+)\))?$/);
          if (match) {
            const playerName = match[1].trim();
            const friendOf = match[2];
            const userId = match[3] || match[4]; // userId может быть в 3-й или 4-й группе
            
            if (playerName && playerName !== '') {
              if (friendOf && userId) {
                // Это друг в резерве с userId
                reserve.push({
                  userId: parseInt(userId), // Преобразуем в число
                  username: null,
                  firstName: playerName,
                  lastName: null,
                  friendOf: friendOf,
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
                if (friendOf) {
                  reserve.push({
                    userId: `friend_reserve_${Date.now()}_${playerName}`,
                    username: null,
                    firstName: playerName,
                    lastName: null,
                    friendOf: friendOf,
                    isFriend: true
                  });
                } else {
                  reserve.push({
                    userId: `reserve_${Date.now()}_${playerName}`,
                    username: null,
                    firstName: playerName,
                    lastName: null
                  });
                }
              }
            }
          }
        }
      }

      // Определяем, активна ли игра
      const isActive = !text.includes('🔚 Завершить игру') || text.includes('✅ Записаться');

      // Создаем новый GameSession
      const gameSession = new GameSession(chatId, messageId, playersLimit, true, gameDescription, friends);
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
