const socket = io('http://localhost:3000');

const lobby = document.getElementById('lobby');
const gameContainer = document.getElementById('game-container');
const usernameInput = document.getElementById('username');
const roomCodeInput = document.getElementById('room-code');
const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('color-picker');
const sizePicker = document.getElementById('size-picker');
const clearBtn = document.getElementById('clear-btn');
const drawerTools = document.getElementById('drawer-tools');

const playersList = document.getElementById('players-list');
const messagesDiv = document.getElementById('messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const wordDisplay = document.getElementById('word-display');
const displayRoomCode = document.getElementById('display-room-code');
const copyBtn = document.getElementById('copy-btn');
const startGameBtn = document.getElementById('start-game-btn');

let currentRoomCode = null;
let isDrawing = false;
let isMyTurn = false;

// --- Copy Functionality ---
copyBtn.onclick = () => {
    if (!currentRoomCode) return;
    navigator.clipboard.writeText(currentRoomCode).then(() => {
        const originalText = copyBtn.innerText;
        copyBtn.innerText = 'Copied!';
        copyBtn.style.color = 'var(--accent)';
        setTimeout(() => {
            copyBtn.innerText = originalText;
            copyBtn.style.color = '';
        }, 2000);
    });
};

// Resize canvas
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- Lobby Events ---

createBtn.onclick = () => {
    const username = usernameInput.value.trim();
    if (!username) return alert('Enter username');
    socket.emit('create-room', { username });
};

joinBtn.onclick = () => {
    const username = usernameInput.value.trim();
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    if (!username || !roomCode) return alert('Enter username and room code');
    socket.emit('join-room', { roomCode, username });
};

// --- Socket Events ---

socket.on('room-created', ({ code, room }) => {
    enterGame(code, room);
});

socket.on('join-success', (room) => {
    enterGame(room.code, room);
});

socket.on('room-update', (room) => {
    updateUI(room);
});

socket.on('new-message', ({ username, message }) => {
    addMessage(username, message);
});

socket.on('draw', (data) => {
    drawOnCanvas(data.x, data.y, data.color, data.size, data.type);
});

socket.on('clear-canvas', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

socket.on('error', (err) => {
    alert(err.message);
});

// --- Game Logic ---

function enterGame(code, room) {
    currentRoomCode = code;
    lobby.style.display = 'none';
    gameContainer.style.display = 'grid';
    displayRoomCode.innerText = `#${code}`;
    updateUI(room);
    resizeCanvas();
}

function updateUI(room) {
    playersList.innerHTML = room.players
        .map(p => `
            <div class="player-item ${p.id === room.currentDrawerId ? 'is-drawer' : ''}">
                <span>${p.username}</span>
                <span>${p.score} pts</span>
            </div>
        `).join('');

    isMyTurn = room.currentDrawerId === socket.id;
    drawerTools.style.visibility = isMyTurn ? 'visible' : 'hidden';

    if (room.isStarted) {
        startGameBtn.style.display = 'none';
        if (isMyTurn) {
            wordDisplay.innerText = `DRAW: ${room.currentWord.toUpperCase()}`;
        } else {
            wordDisplay.innerText = `WORD: ${'_ '.repeat(room.wordLength)}`;
        }
    } else {
        // Only show start button to first player for simplicity
        startGameBtn.style.display = room.players[0].id === socket.id ? 'block' : 'none';
    }
}

startGameBtn.onclick = () => {
    socket.emit('start-game', { roomCode: currentRoomCode });
};

// --- Drawing Logic ---

canvas.onmousedown = (e) => {
    if (!isMyTurn) return;
    isDrawing = true;
    const pos = getMousePos(e);
    emitDraw(pos.x, pos.y, 'start');
};

canvas.onmousemove = (e) => {
    if (!isDrawing || !isMyTurn) return;
    const pos = getMousePos(e);
    emitDraw(pos.x, pos.y, 'draw');
};

canvas.onmouseup = () => {
    isDrawing = false;
};

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height
    };
}

function emitDraw(x, y, type) {
    const color = colorPicker.value;
    const size = sizePicker.value;
    drawOnCanvas(x, y, color, size, type);
    socket.emit('draw', {
        roomCode: currentRoomCode,
        data: { x, y, color, size, type }
    });
}

let lastX, lastY;
function drawOnCanvas(x, y, color, size, type) {
    const realX = x * canvas.width;
    const realY = y * canvas.height;

    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (type === 'start') {
        ctx.beginPath();
        ctx.moveTo(realX, realY);
    } else {
        ctx.lineTo(realX, realY);
        ctx.stroke();
    }
    lastX = realX;
    lastY = realY;
}

clearBtn.onclick = () => {
    socket.emit('clear-canvas', { roomCode: currentRoomCode });
};

// --- Chat Logic ---

sendBtn.onclick = sendMessage;
chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };

function sendMessage() {
    const msg = chatInput.value.trim();
    if (!msg) return;
    socket.emit('send-message', {
        roomCode: currentRoomCode,
        message: msg,
        username: usernameInput.value
    });
    chatInput.value = '';
}

function addMessage(user, msg) {
    const div = document.createElement('div');
    div.className = user === 'System' ? 'message system' : 'message';
    div.innerHTML = user === 'System' ? msg : `<span class="user">${user}:</span> ${msg}`;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
