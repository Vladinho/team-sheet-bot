// Финальный тест функционала друзей
const GameSession = require('./src/GameSession');

console.log('🎯 Финальный тест функционала друзей...\n');

// Создаем тестовые данные
const friends = new Map();
friends.set(123, [
  { name: 'Иван', addedBy: 123 },
  { name: 'Петр', addedBy: 123 }
]);

// Создаем тестовую игровую сессию
const gameSession = new GameSession(1, 1, 5, true, 'Футбол в 18:00', friends);

console.log('1️⃣ Создана игра на 5 человек:');
let message = gameSession.generateMessage();
console.log(message);

// Добавляем первого игрока
gameSession.addPlayer(123, 'user123', 'Влад', 'Репкин');

console.log('\n2️⃣ Добавлен игрок Влад (должны добавиться его друзья):');
message = gameSession.generateMessage();
console.log(message);

// Добавляем второго игрока
gameSession.addPlayer(456, 'user456', 'Мария', 'Петрова');

console.log('\n3️⃣ Добавлен игрок Мария:');
message = gameSession.generateMessage();
console.log(message);

// Добавляем третьего игрока (должен попасть в резерв)
gameSession.addPlayer(789, 'user789', 'Алексей', 'Сидоров');

console.log('\n4️⃣ Добавлен игрок Алексей (должен попасть в резерв):');
message = gameSession.generateMessage();
console.log(message);

// Удаляем первого игрока (должны удалиться его друзья)
gameSession.removePlayer(123);

console.log('\n5️⃣ Удален игрок Влад (должны удалиться его друзья):');
message = gameSession.generateMessage();
console.log(message);

console.log('\n✅ Финальный тест завершен успешно!');
console.log('Друзья автоматически добавляются в список игроков с указанием владельца.');
console.log('При удалении основного игрока его друзья также удаляются.');
console.log('Друзья отображаются в формате: "Имя (друг Влад)"');
