const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const GAME = {
  name: 'Tên game',
  minPlayers: 3,
  maxPlayers: 7,
  maxBots: 7,
  rules: [
    'Thay luật chơi tại đây.',
    'Mỗi phòng có thể có nhiều người chơi.',
    'Chủ phòng có thể thêm bot và kick người chơi.',
    'Bấm Bắt đầu khi đủ số người tối thiểu.',
    'Gameplay nằm trong public/game.html.'
  ]
};

app.use(express.static(path.join(__dirname, 'public')));
app.get('/config.js', (_req, res) => {
  res.type('application/javascript').send(`window.GAME_CONFIG = ${JSON.stringify(GAME)};`);
});
app.get('/health', (_req, res) => res.json({ ok: true }));

const rooms = new Map();

function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function sanitizeName(name) {
  const value = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 24);
  return value || 'Người chơi';
}

function publicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    started: room.started,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      botId: p.botId
    }))
  };
}

function emitRoom(room) {
  io.to(room.code).emit('room:update', publicRoom(room));
}

function canHost(socket, room) {
  return room && room.hostId === socket.id;
}

function addPlayer(room, player) {
  if (room.players.length >= GAME.maxPlayers) return false;
  room.players.push(player);
  return true;
}

function removeById(room, playerId) {
  const index = room.players.findIndex((p) => p.id === playerId);
  if (index === -1) return null;
  return room.players.splice(index, 1)[0];
}

function rebalanceHost(room) {
  const firstHuman = room.players.find((p) => !p.isBot);
  if (firstHuman) room.hostId = firstHuman.id;
  else if (room.players[0]) room.hostId = room.players[0].id;
}

io.on('connection', (socket) => {
  socket.on('room:create', ({ name }) => {
    if (socket.data.roomCode) return socket.emit('room:error', 'Bạn đã ở trong một phòng.');

    const code = makeRoomCode();
    const room = {
      code,
      hostId: socket.id,
      started: false,
      players: []
    };

    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerId = socket.id;

    addPlayer(room, {
      id: socket.id,
      name: sanitizeName(name),
      isBot: false
    });

    socket.emit('room:joined', publicRoom(room));
    emitRoom(room);
  });

  socket.on('room:join', ({ name, code }) => {
    if (socket.data.roomCode) return socket.emit('room:error', 'Bạn đã ở trong một phòng.');

    const normalized = String(code || '').trim().toUpperCase();
    const room = rooms.get(normalized);
    if (!room) return socket.emit('room:error', 'Không tìm thấy phòng.');
    if (room.started) return socket.emit('room:error', 'Ván chơi đã bắt đầu.');
    if (room.players.length >= GAME.maxPlayers) return socket.emit('room:error', 'Phòng đã đầy.');

    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.playerId = socket.id;

    addPlayer(room, {
      id: socket.id,
      name: sanitizeName(name),
      isBot: false
    });

    socket.emit('room:joined', publicRoom(room));
    emitRoom(room);
  });

  socket.on('room:addBot', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!canHost(socket, room)) return;
    if (room.started) return;
    if (room.players.length >= GAME.maxPlayers) return socket.emit('room:error', 'Phòng đã đủ người.');

    const botCount = room.players.filter((p) => p.isBot).length;
    if (botCount >= GAME.maxBots) return socket.emit('room:error', 'Đã đạt số bot tối đa.');

    let botIndex = 1;
    const existingNames = new Set(room.players.map((p) => p.name));
    while (existingNames.has(`Bot ${botIndex}`)) botIndex++;

    room.players.push({
      id: `bot-${room.code}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `Bot ${botIndex}`,
      isBot: true,
      botId: botIndex
    });

    emitRoom(room);
  });

  socket.on('room:kick', ({ playerId }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!canHost(socket, room) || room.started) return;
    if (playerId === socket.id) return;

    const removed = removeById(room, playerId);
    if (!removed) return;

    if (!removed.isBot) {
      io.to(removed.id).emit('room:kicked');
      const kickedSocket = io.sockets.sockets.get(removed.id);
      if (kickedSocket) {
        kickedSocket.leave(room.code);
        kickedSocket.data.roomCode = null;
        kickedSocket.data.playerId = null;
      }
    }

    emitRoom(room);
  });

  socket.on('room:start', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!canHost(socket, room)) return;
    if (room.started) return;
    if (room.players.length < GAME.minPlayers) {
      return socket.emit('room:error', `Cần ít nhất ${GAME.minPlayers} người để bắt đầu.`);
    }

    room.started = true;
    emitRoom(room);
    io.to(room.code).emit('game:start', publicRoom(room));
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    removeById(room, socket.id);

    if (room.players.length === 0) {
      rooms.delete(code);
      return;
    }

    if (room.hostId === socket.id) {
      rebalanceHost(room);
    }

    emitRoom(room);
  });
});

server.listen(PORT, () => {
  console.log(`Game Online Template running on port ${PORT}`);
});
