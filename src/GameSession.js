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
          message += `${i}. ${player.firstName} (друг ${this.getPlayerNameById(player.friendOf)})\n`;
        } else {
          message += `${i}. ${player.firstName || player.username || `User${player.userId}`}\n`;
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
          message += `${index + 1}. ${player.firstName} (друг ${this.getPlayerNameById(player.friendOf)})\n`;
        } else {
          message += `${index + 1}. ${player.firstName || player.username || `User${player.userId}`}\n`;
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
    return player ? (player.firstName || player.username || `User${userId}`) : `User${userId}`;
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


}

module.exports = GameSession;
