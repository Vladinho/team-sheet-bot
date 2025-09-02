const https = require('https');

class NetworkMonitor {
  constructor() {
    this.lastKnownIP = null;
    this.lastCheckTime = 0;
    this.checkInterval = 60000; // 1 минута
    this.ipCheckServices = [
      'https://api.ipify.org?format=json',
      'https://ipinfo.io/json',
      'https://httpbin.org/ip'
    ];
    this.currentServiceIndex = 0;
    this.isMonitoring = false;
  }

  // Запуск мониторинга сети
  start() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('🌐 Запуск мониторинга сети...');
    
    // Первая проверка
    this.checkIP();
    
    // Периодическая проверка
    this.interval = setInterval(() => {
      this.checkIP();
    }, this.checkInterval);
  }

  // Остановка мониторинга
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isMonitoring = false;
    console.log('🌐 Мониторинг сети остановлен');
  }

  // Проверка IP адреса
  async checkIP() {
    try {
      const ip = await this.getCurrentIP();
      
      if (ip) {
        this.handleIPChange(ip);
      }
      
      this.lastCheckTime = Date.now();
      
    } catch (error) {
      console.log('⚠️ Ошибка проверки IP:', error.message);
      
      // Пробуем следующий сервис
      this.currentServiceIndex = (this.currentServiceIndex + 1) % this.ipCheckServices.length;
    }
  }

  // Получение текущего IP адреса
  async getCurrentIP() {
    return new Promise((resolve, reject) => {
      const url = this.ipCheckServices[this.currentServiceIndex];
      
      const req = https.get(url, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            
            // Разные сервисы возвращают IP в разных полях
            let ip = json.ip || json.query || json.origin;
            
            if (ip) {
              resolve(ip);
            } else {
              reject(new Error('IP не найден в ответе'));
            }
            
          } catch (error) {
            reject(new Error('Ошибка парсинга JSON'));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Таймаут запроса'));
      });
    });
  }

  // Обработка изменения IP
  handleIPChange(newIP) {
    if (this.lastKnownIP && this.lastKnownIP !== newIP) {
      console.log(`🌐 Обнаружена смена IP: ${this.lastKnownIP} → ${newIP}`);
      
      // Вызываем callback для уведомления о смене сети
      if (this.onNetworkChange) {
        this.onNetworkChange(newIP, this.lastKnownIP);
      }
    }
    
    this.lastKnownIP = newIP;
  }

  // Принудительная проверка IP
  forceCheck() {
    console.log('🔍 Принудительная проверка IP адреса...');
    this.checkIP();
  }

  // Получение информации о сети
  getNetworkInfo() {
    return {
      currentIP: this.lastKnownIP,
      lastCheck: this.lastCheckTime,
      isMonitoring: this.isMonitoring,
      uptime: this.lastCheckTime ? Date.now() - this.lastCheckTime : 0
    };
  }

  // Установка callback для уведомления о смене сети
  onNetworkChange(callback) {
    this.onNetworkChange = callback;
  }
}

module.exports = NetworkMonitor;
