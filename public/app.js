const socket = io();
const config = window.GAME_CONFIG || {};

const $ = (id) => document.getElementById(id);
const state = {
  room: null,
  playerName: '',
  started: false
};

$('gameName').textContent = config.name || 'Tên game';
$('playerLimit').textContent = `Cần ít nhất ${config.minPlayers} người · tối đa ${config.maxPlayers} người`;
$('rules').innerHTML = (config.rules || []).map((rule) => `<li>${escapeHtml(rule)}</li>`).join('');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showError(message) {
  $('error').textContent = message || '';
  $('error').hidden = !message;
}

function clearError() {
  showError('');
}

function renderRoom(room) {
  state.room = room;
  state.started = room.started;
  $('setupView').hidden = true;
  $('roomView').hidden = false;
  $('roomCodeLabel').textContent = room.code;
  $('playerLimit').textContent = `Cần ít nhất ${config.minPlayers} người · tối đa ${config.maxPlayers} người`;

  const isHost = room.hostId === socket.id;
  const container = $('players');
  container.innerHTML = '';

  room.players.forEach((player) => {
    const chip = document.createElement('div');
    chip.className = 'player-chip';

    const name = document.createElement('span');
    const crown = player.id === room.hostId ? ' 👑' : '';
    const me = player.id === socket.id ? ' (Bạn)' : '';
    name.textContent = `${player.name}${crown}${me}`;
    chip.appendChild(name);

    if (isHost && player.id !== socket.id) {
      const kick = document.createElement('button');
      kick.className = 'kick-btn';
      kick.textContent = 'KICK';
      kick.addEventListener('click', () => socket.emit('room:kick', { playerId: player.id }));
      chip.appendChild(kick);
    }

    container.appendChild(chip);
  });

  $('addBotBtn').disabled = !isHost || room.started || room.players.length >= config.maxPlayers;
  $('startBtn').disabled = !isHost || room.started || room.players.length < config.minPlayers;
}

function goToGame(room) {
  const params = new URLSearchParams({ room: room.code });
  window.location.href = `/game.html?${params.toString()}`;
}

$('createBtn').addEventListener('click', () => {
  clearError();
  const name = $('playerName').value.trim();
  if (!name) return showError('Hãy nhập tên người chơi.');
  state.playerName = name;
  socket.emit('room:create', { name });
});

$('joinBtn').addEventListener('click', () => {
  clearError();
  const name = $('playerName').value.trim();
  const code = $('roomCode').value.trim().toUpperCase();
  if (!name) return showError('Hãy nhập tên người chơi.');
  if (!code) return showError('Hãy nhập mã phòng.');
  state.playerName = name;
  socket.emit('room:join', { name, code });
});

$('addBotBtn').addEventListener('click', () => {
  clearError();
  socket.emit('room:addBot');
});

$('startBtn').addEventListener('click', () => {
  clearError();
  socket.emit('room:start');
});

$('copyBtn').addEventListener('click', async () => {
  if (!state.room?.code) return;
  try {
    await navigator.clipboard.writeText(state.room.code);
    const original = $('copyBtn').textContent;
    $('copyBtn').textContent = '✓ Đã sao chép';
    setTimeout(() => { $('copyBtn').textContent = original; }, 1200);
  } catch {
    showError(`Mã phòng: ${state.room.code}`);
  }
});

$('leaveBtn').addEventListener('click', () => window.location.reload());

$('playerName').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') $('createBtn').click();
});
$('roomCode').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') $('joinBtn').click();
});

socket.on('room:joined', (room) => {
  clearError();
  renderRoom(room);
});

socket.on('room:update', (room) => renderRoom(room));

socket.on('room:error', (message) => showError(message));

socket.on('room:kicked', () => {
  alert('Bạn đã bị chủ phòng kick.');
  window.location.reload();
});

socket.on('game:start', (room) => goToGame(room));
