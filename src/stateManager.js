const fs = require('fs').promises;
const path = require('path');
const GameSession = require('./GameSession');

class StateManager {
  constructor() {
    this.stateFile = path.join(__dirname, '..', 'data', 'state.json');
    this.ensureDataDirectory();
  }

  async ensureDataDirectory() {
    try {
      await fs.mkdir(path.dirname(this.stateFile), { recursive: true });
    } catch (error) {
      console.log('Директория data уже существует или ошибка создания:', error.message);
    }
  }

  async saveState(gameSessions, userStates, friends) {
    try {
      const state = {
        gameSessions: Array.from(gameSessions.entries()),
        userStates: Array.from(userStates.entries()),
        friends: Array.from(friends.entries()),
        timestamp: new Date().toISOString()
      };

      await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2));
      console.log('Состояние сохранено в файл');
    } catch (error) {
      console.error('Ошибка сохранения состояния:', error);
    }
  }

  async loadState() {
    try {
      const data = await fs.readFile(this.stateFile, 'utf8');
      const state = JSON.parse(data);
      
      // Восстанавливаем GameSession объекты
      const gameSessions = new Map();
      if (state.gameSessions) {
        for (const [chatId, gameSessionData] of state.gameSessions) {
          const gameSession = new GameSession(
            gameSessionData.chatId,
            gameSessionData.messageId,
            gameSessionData.playersLimit,
            gameSessionData.isAdmin,
            gameSessionData.gameDescription,
            new Map(state.friends || [])
          );
          
          // Восстанавливаем свойства
          gameSession.players = gameSessionData.players || [];
          gameSession.reserve = gameSessionData.reserve || [];
          gameSession.isActive = gameSessionData.isActive !== undefined ? gameSessionData.isActive : true;
          gameSession.lastMessageId = gameSessionData.lastMessageId || gameSessionData.messageId;
          
          gameSessions.set(chatId, gameSession);
        }
      }
      
      const userStates = new Map(state.userStates || []);
      const friends = new Map(state.friends || []);
      
      // Обновляем ссылку на friends во всех GameSession объектах
      for (const gameSession of gameSessions.values()) {
        gameSession.friends = friends;
      }
      
      console.log('Состояние загружено из файла');
      console.log(`- Игровых сессий: ${gameSessions.size}`);
      console.log(`- Состояний пользователей: ${userStates.size}`);
      console.log(`- Списков друзей: ${friends.size}`);
      
      return { gameSessions, userStates, friends };
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('Файл состояния не найден, создаем новое состояние');
      } else {
        console.error('Ошибка загрузки состояния:', error);
      }
      
      return {
        gameSessions: new Map(),
        userStates: new Map(),
        friends: new Map()
      };
    }
  }

  // Автоматическое сохранение каждые 30 секунд
  startAutoSave(gameSessions, userStates, friends) {
    setInterval(() => {
      this.saveState(gameSessions, userStates, friends);
    }, 30000); // 30 секунд
  }
}

module.exports = StateManager;
