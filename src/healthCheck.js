const TelegramBot = require('node-telegram-bot-api');

class BotHealthChecker {
  constructor(bot, token) {
    this.bot = bot;
    this.token = token;
    this.isHealthy = true;
    this.lastHealthCheck = Date.now();
    this.healthCheckInterval = null;
    this.startHealthCheck();
  }

  // Запуск периодической проверки здоровья
  startHealthCheck() {
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth();
    }, 30000); // Проверяем каждые 30 секунд
  }

  // Проверка здоровья бота
  async checkHealth() {
    try {
      // Проверяем API Telegram
      const response = await fetch(`https://api.telegram.org/bot${this.token}/getMe`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(`Telegram API error: ${data.description}`);
      }

      // Если все хорошо, обновляем статус
      if (!this.isHealthy) {
        console.log('✅ Соединение с Telegram восстановлено');
        this.isHealthy = true;
      }

      this.lastHealthCheck = Date.now();
      
    } catch (error) {
      console.error('❌ Ошибка проверки здоровья:', error.message);
      
      if (this.isHealthy) {
        console.log('🌐 Обнаружена проблема с соединением');
        this.isHealthy = false;
        
        // Уведомляем администратора о проблеме
        this.notifyAdminAboutIssue();
      }
    }
  }

  // Уведомление администратора о проблеме
  async notifyAdminAboutIssue() {
    try {
      // Здесь можно добавить логику уведомления
      console.log('📢 Уведомление: Проблема с соединением бота');
    } catch (error) {
      console.error('❌ Ошибка уведомления администратора:', error.message);
    }
  }

  // Получение статуса здоровья
  getStatus() {
    return {
      isHealthy: this.isHealthy,
      lastHealthCheck: this.lastHealthCheck,
      uptime: Date.now() - this.lastHealthCheck
    };
  }

  // Остановка проверки здоровья
  stop() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

module.exports = BotHealthChecker;
