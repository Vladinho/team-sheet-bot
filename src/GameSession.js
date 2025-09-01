class GameSession {
  constructor(chatId, messageId, playersLimit = 10, isAdmin = false, gameDescription = '', friends = null) {
    this.chatId = chatId;
    this.messageId = messageId;
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
    const playersList = this.players.map(p => 
      `👤 ${p.firstName || p.username || `User${p.userId}`}`
    ).join('\n');

    const reserveList = this.reserve.map(p => 
      `⏳ ${p.firstName || p.username || `User${p.userId}`} (резерв)`
    ).join('\n');

    let message = `⚽ <b>Запись на игру</b>\n\n`;
    
    if (this.gameDescription) {
      message += `📝 <b>Описание:</b>\n${this.gameDescription}\n\n`;
    }
    
    message += `📊 <b>Статистика:</b>\n`;
    message += `• Игроков: ${this.players.length}/${this.playersLimit}\n`;
    message += `• В резерве: ${this.reserve.length}\n\n`;

    if (playersList) {
      message += `👥 <b>Записались:</b>\n${playersList}\n\n`;
    }

    if (reserveList) {
      message += `⏳ <b>Резерв:</b>\n${reserveList}\n\n`;
    }

    // Добавляем список друзей, если есть
    if (this.friends && this.friends.size > 0) {
      let friendsList = '';
      for (const [userId, userFriends] of this.friends) {
        if (userFriends.length > 0) {
          // Ищем пользователя среди игроков или резерва
          const player = this.players.find(p => p.userId === userId) || 
                        this.reserve.find(p => p.userId === userId);
          
          if (player) {
            // Если пользователь записан на игру, показываем его друзей
            const playerName = player.firstName || player.username || `User${userId}`;
            const friendsNames = userFriends.map(f => f.name).join(', ');
            friendsList += `👥 ${playerName}: ${friendsNames}\n`;
          } else {
            // Если пользователь не записан, но у него есть друзья, показываем их
            const userFriendsNames = userFriends.map(f => f.name).join(', ');
            friendsList += `🤝 Друзья: ${userFriendsNames}\n`;
          }
        }
      }
      
      if (friendsList) {
        message += `🤝 <b>Друзья:</b>\n${friendsList}\n`;
      }
    }

    return message;
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
