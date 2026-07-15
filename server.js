import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { ExpressPeerServer } from 'peer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Attach PeerJS Server
const peerServer = ExpressPeerServer(httpServer, {
  debug: true,
  path: '/'
});
app.use('/peerjs', peerServer);

// Serve Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Store active users in memory
const users = new Map();

io.on('connection', (socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);

  // 1. Join Voice Room
  socket.on('join_room', (data) => {
    const userData = {
      id: socket.id,
      name: data.name || 'Anonymous',
      color: data.color || '#00f0ff',
      x: data.position?.x || Math.random() * 600 + 100,
      y: data.position?.y || Math.random() * 400 + 100,
      peerId: data.peerId,
      isSpeaking: false,
      whisperWith: null
    };

    users.set(socket.id, userData);

    // Send currently connected users list to the joining user
    const userList = Array.from(users.values());
    socket.emit('existing_users', userList);

    // Broadcast to everyone else that a new user joined
    socket.broadcast.emit('user_joined', userData);

    console.log(`[Room] ${userData.name} (${socket.id}) joined with PeerID: ${userData.peerId}`);
  });

  // 2. Position Updates (Drag & Drop)
  socket.on('update_position', (pos) => {
    const user = users.get(socket.id);
    if (user) {
      user.x = pos.x;
      user.y = pos.y;
      socket.broadcast.emit('position_updated', {
        id: socket.id,
        x: pos.x,
        y: pos.y
      });
    }
  });

  // 3. Active Speaking Indicator
  socket.on('speaking_state', (data) => {
    const user = users.get(socket.id);
    if (user) {
      user.isSpeaking = !!data.isSpeaking;
      io.emit('speaking_state_changed', {
        id: socket.id,
        isSpeaking: user.isSpeaking
      });
    }
  });

  // 4. Secret Whisper Handshake
  socket.on('whisper_request', ({ targetId }) => {
    const requester = users.get(socket.id);
    const target = users.get(targetId);

    if (requester && target) {
      console.log(`[Whisper] ${requester.name} requested whisper with ${target.name}`);
      io.to(targetId).emit('incoming_whisper_request', {
        requesterId: socket.id,
        requesterName: requester.name
      });
    }
  });

  socket.on('whisper_response', ({ requesterId, accepted }) => {
    const target = users.get(socket.id);
    const requester = users.get(requesterId);

    if (accepted && requester && target) {
      // Set whisper relationship
      requester.whisperWith = socket.id;
      target.whisperWith = requesterId;

      console.log(`[Whisper] Started between ${requester.name} and ${target.name}`);

      // Broadcast to everyone so lock overlays render on both users
      io.emit('whisper_started', {
        user1: requesterId,
        user2: socket.id
      });
    } else if (requester) {
      io.to(requesterId).emit('whisper_declined', {
        targetName: target ? target.name : 'User'
      });
    }
  });

  socket.on('whisper_end', () => {
    const user = users.get(socket.id);
    if (user && user.whisperWith) {
      const partnerId = user.whisperWith;
      const partner = users.get(partnerId);

      user.whisperWith = null;
      if (partner) partner.whisperWith = null;

      console.log(`[Whisper] Ended between ${socket.id} and ${partnerId}`);

      io.emit('whisper_ended', {
        user1: socket.id,
        user2: partnerId
      });
    }
  });

  // 5. User Disconnection Cleanup
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      // If user was in whisper, notify partner
      if (user.whisperWith) {
        const partner = users.get(user.whisperWith);
        if (partner) {
          partner.whisperWith = null;
          io.to(user.whisperWith).emit('whisper_ended', {
            user1: socket.id,
            user2: user.whisperWith
          });
        }
      }

      users.delete(socket.id);
      io.emit('user_left', { id: socket.id });
      console.log(`[Socket] User left: ${socket.id}`);
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 ShadowVoice PWA Server running on port ${PORT}`);
  console.log(`   Local URL: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
