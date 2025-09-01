class GameSession {
  constructor(chatId, messageId, playersLimit = 10) {
    this.chatId = chatId;
    this.messageId = messageId;
    this.playersLimit = playersLimit;
    this.players = []; // [{userId, username, firstName, lastName}]
    this.reserve = []; // [{userId, username, firstName, lastName}]
    this.friends = new Map(); // userId -> [{name, addedBy}]
    this.isActive = true;
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

  addFriend(userId, friendName, addedBy) {
    if (!this.friends.has(userId)) {
      this.friends.set(userId, []);
    }
    
    const userFriends = this.friends.get(userId);
    const maxFriends = userId === parseInt(process.env.ADMIN_ID) ? Infinity : 2;
    
    if (userFriends.length < maxFriends) {
      userFriends.push({ name: friendName, addedBy });
      return true;
    }
    return false;
  }

  removeFriend(userId, friendName) {
    if (this.friends.has(userId)) {
      const userFriends = this.friends.get(userId);
      const index = userFriends.findIndex(f => f.name === friendName);
      if (index !== -1) {
        userFriends.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  getFriendsList(userId) {
    return this.friends.get(userId) || [];
  }

  generateMessage() {
    const playersList = this.players.map(p => 
      `👤 ${p.firstName || p.username || `User${p.userId}`}`
    ).join('\n');

    const reserveList = this.reserve.map(p => 
      `⏳ ${p.firstName || p.username || `User${p.userId}`} (резерв)`
    ).join('\n');

    const friendsList = Array.from(this.friends.entries()).map(([userId, friends]) => {
      const user = [...this.players, ...this.reserve].find(p => p.userId === userId);
      const userName = user ? (user.firstName || user.username || `User${userId}`) : `User${userId}`;
      const friendsText = friends.map(f => f.name).join(', ');
      return `👥 ${userName}: ${friendsText}`;
    }).join('\n');

    let message = `⚽ <b>Запись на игру</b>\n\n`;
    message += `📊 <b>Статистика:</b>\n`;
    message += `• Игроков: ${this.players.length}/${this.playersLimit}\n`;
    message += `• В резерве: ${this.reserve.length}\n\n`;

    if (playersList) {
      message += `👥 <b>Записались:</b>\n${playersList}\n\n`;
    }

    if (reserveList) {
      message += `⏳ <b>Резерв:</b>\n${reserveList}\n\n`;
    }

    if (friendsList) {
      message += `👥 <b>Друзья:</b>\n${friendsList}\n\n`;
    }

    return message;
  }

  generateKeyboard() {
    const keyboard = [];
    
    if (this.isActive) {
      keyboard.push([
        { text: '✅ Записаться', callback_data: 'register' },
        { text: '❌ Отменить запись', callback_data: 'unregister' }
      ]);
      
      keyboard.push([
        { text: '👥 Записать друга', callback_data: 'add_friend' },
        { text: '🗑 Удалить друга', callback_data: 'remove_friend' }
      ]);
    }

    if (this.players.length >= this.playersLimit && this.isActive) {
      keyboard.push([
        { text: '⏳ Записаться в резерв', callback_data: 'register_reserve' }
      ]);
    }

    return keyboard;
  }
}

module.exports = GameSession;
