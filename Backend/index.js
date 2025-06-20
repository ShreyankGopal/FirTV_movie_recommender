import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import mediasoup from 'mediasoup';
import preferenceSelection from './PreferenceSelection.js';
import axios from 'axios';
// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Room management
const rooms = new Map(); // Store room data: { roomId: { router, participants, producers } }

// Mediasoup configuration
let worker;

const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000,
    },
  },
];

(async () => {
  worker = await mediasoup.createWorker({
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
  });
  console.log('Mediasoup worker created');
})();

// Helper function to create router for each room
async function createRouterForRoom() {
  return await worker.createRouter({ mediaCodecs });
}

// Routes
app.get('/play-together/:roomId', async (req, res) => {
  const { roomId } = req.params;
  if (rooms.has(roomId)) {
    res.status(200).json({ message: 'Room exists' });
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});

app.post('/create-room', async (req, res) => {
  const { roomId } = req.body;
  if (!roomId) {
    return res.status(400).json({ error: 'Room ID required' });
  }
  if (rooms.has(roomId)) {
    return res.status(409).json({ error: 'Room already exists' });
  }
  
  try {
    const router = await createRouterForRoom();
    rooms.set(roomId, { 
      router, 
      participants: new Map(), 
      producers: new Map() // Map<socketId, Array<{id, kind, producer}>>
    });
    console.log('Room created:', roomId);
    res.status(201).json({ message: 'Room created', roomId });
  } catch (err) {
    console.error('Error creating room:', err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Socket.IO handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Initialize socket storage
  socket.transports = {};
  socket.producers = new Map(); // Map<producerId, producer>
  socket.consumers = new Map(); // Map<consumerId, consumer>

  socket.on('join-room', async ({ roomId, username }, callback) => {
    console.log('Join request for room:', roomId, 'by socket:', socket.id);
    
    let room = rooms.get(roomId);
    if (!room) {
      console.log('Creating room:', roomId, 'because it does not exist');
      try {
        const router = await createRouterForRoom();
        room = { 
          router, 
          participants: new Map(), 
          producers: new Map()
        };
        rooms.set(roomId, room);
      } catch (err) {
        console.error('Error creating room during join:', err);
        return callback({ error: 'Failed to create room' });
      }
    }

    room.participants.set(socket.id, { username });
    socket.join(roomId);
    socket.currentRoom = roomId;

    // Provide RTP capabilities and existing producers
    const rtpCapabilities = room.router.rtpCapabilities;
    const existingProducers = Array.from(room.producers.entries()).map(([socketId, producers]) => ({
      socketId,
      username: room.participants.get(socketId)?.username || 'Unknown',
      producers: producers.map((p) => ({ id: p.id, kind: p.kind })),
    }));

    callback({ rtpCapabilities, existingProducers });

    // Notify other participants
    socket.to(roomId).emit('new-participant', { socketId: socket.id, username });
    console.log(`Participant ${socket.id} joined room ${roomId} with username ${username}`);
  });

  socket.on('create-producer-transport', async ({ roomId }, callback) => {
    console.log('Create producer transport request for room:', roomId, 'by socket:', socket.id);
    
    const room = rooms.get(roomId);
    if (!room) {
      console.log('Room does not exist during producer transport creation:', roomId);
      return callback({ error: 'Room does not exist' });
    }
    
    try {
      const transport = await room.router.createWebRtcTransport({
        listenIps: [{ ip: '0.0.0.0', announcedIp: '127.0.0.1' }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });
      
      socket.transports.producer = transport;

      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });

      transport.on('dtlsstatechange', (dtlsState) => {
        console.log('Producer transport DTLS state:', dtlsState, 'for socket:', socket.id);
        if (dtlsState === 'connected') {
          console.log('Producer transport connected:', transport.id);
        }
      });

      transport.on('icestatechange', (iceState) => {
        console.log('Producer transport ICE state:', iceState, 'for socket:', socket.id);
      });
      
    } catch (err) {
      console.error('Create producer transport error:', err);
      callback({ error: 'Failed to create producer transport' });
    }
  });

  socket.on('create-consumer-transport', async ({ roomId }, callback) => {
    console.log('Create consumer transport request for room:', roomId, 'by socket:', socket.id);
    
    const room = rooms.get(roomId);
    if (!room) {
      console.log('Room does not exist during consumer transport creation:', roomId);
      return callback({ error: 'Room does not exist' });
    }
    
    try {
      const transport = await room.router.createWebRtcTransport({
        listenIps: [{ ip: '0.0.0.0', announcedIp: '127.0.0.1' }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });
      
      socket.transports.consumer = transport;

      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });

      transport.on('dtlsstatechange', (dtlsState) => {
        console.log('Consumer transport DTLS state:', dtlsState, 'for socket:', socket.id, 'Transport ID:', transport.id);
        if (dtlsState === 'connected') {
          console.log('Consumer transport connected:', transport.id);
        }
      });

      transport.on('icestatechange', (iceState) => {
        console.log('Consumer transport ICE state:', iceState, 'for socket:', socket.id, 'Transport ID:', transport.id);
      });
      
    } catch (err) {
      console.error('Create consumer transport error for socket:', socket.id, 'Error:', err);
      callback({ error: 'Failed to create consumer transport' });
    }
  });

  socket.on('connect-transport', async ({ roomId, transportId, dtlsParameters }, callback) => {
    console.log('Connect transport request for room:', roomId, 'transport:', transportId, 'by socket:', socket.id);
    
    const room = rooms.get(roomId);
    if (!room || !socket.transports) {
      console.log('Invalid room or transport during connect:', roomId, transportId);
      return callback({ error: 'Invalid room or transport' });
    }
    
    const transport = socket.transports.producer?.id === transportId ? 
                     socket.transports.producer : socket.transports.consumer;
    
    if (!transport) {
      console.log('Transport not found:', transportId);
      return callback({ error: 'Transport not found' });
    }
    
    try {
      await transport.connect({ dtlsParameters });
      console.log('Transport connected successfully:', transportId);
      callback({});
    } catch (err) {
      console.error('Connect transport error:', err);
      callback({ error: 'Failed to connect transport' });
    }
  });

  socket.on('produce', async ({ roomId, kind, rtpParameters, transportId }, callback) => {
    console.log('Produce request for room:', roomId, 'kind:', kind, 'by socket:', socket.id);
    
    const room = rooms.get(roomId);
    if (!room || !socket.transports?.producer) {
      console.log('Invalid room or producer transport during produce:', roomId, transportId);
      return callback({ error: 'Invalid room or transport' });
    }
    
    try {
      const producer = await socket.transports.producer.produce({ kind, rtpParameters });
      
      // Store producer in socket
      socket.producers.set(producer.id, producer);

      // Store producer in room
      const producers = room.producers.get(socket.id) || [];
      producers.push({ id: producer.id, kind, producer });
      room.producers.set(socket.id, producers);

      console.log(`Producer created: ${producer.id} for kind ${kind} by ${socket.id}`);
      callback({ id: producer.id });

      // Notify other participants
      io.in(roomId).emit('new-producer', { producerId: producer.id, socketId: socket.id, kind });
      
      console.log(`New producer notification sent: ${producer.id} for kind ${kind}`);
      
    } catch (err) {
      console.error('Produce error:', err);
      callback({ error: 'Failed to produce' });
    }
  });

  socket.on('consume', async ({ roomId, producerId, rtpCapabilities }, callback) => {
    console.log('Consume request for room:', roomId, 'producer:', producerId, 'by socket:', socket.id);
    
    const room = rooms.get(roomId);
    if (!room || !socket.transports?.consumer) {
      console.log('Invalid room or consumer transport during consume:', roomId);
      return callback({ error: 'Invalid room or consumer transport' });
    }
    
    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      console.log('Cannot consume producer:', producerId);
      return callback({ error: 'Cannot consume' });
    }
    
    try {
      const consumer = await socket.transports.consumer.consume({
        producerId,
        rtpCapabilities,
        paused: true,
      });

      // Store consumer in socket
      socket.consumers.set(consumer.id, consumer);

      console.log(`Consumer created: ${consumer.id} for producer: ${producerId} by socket: ${socket.id}`);

      callback({
        producerId,
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
      });

      consumer.on('producerclose', () => {
        console.log('Consumer closed due to producer close:', consumer.id);
        socket.consumers.delete(consumer.id);
        consumer.close();
      });

      consumer.on('producerpause', () => {
        console.log('Consumer paused due to producer pause:', consumer.id);
      });

      consumer.on('producerresume', () => {
        console.log('Consumer resumed due to producer resume:', consumer.id);
      });
      
    } catch (err) {
      console.error('Consume error for producer:', producerId, 'Error:', err);
      callback({ error: 'Failed to consume' });
    }
  });

  socket.on('resume-consumer', async ({ consumerId }, callback) => {
    console.log('Resume consumer request for consumer:', consumerId, 'by socket:', socket.id);
    
    const consumer = socket.consumers.get(consumerId);
    if (!consumer) {
      console.log('Consumer not found:', consumerId);
      return callback({ error: 'Consumer not found' });
    }
    
    try {
      await consumer.resume();
      console.log('Consumer resumed successfully:', consumerId);
      callback({});
    } catch (err) {
      console.error('Resume consumer error:', err);
      callback({ error: 'Failed to resume consumer' });
    }
  });

  // Handle player state changes
  socket.on('player-state', ({ playing, roomId }) => {
    console.log(`Player state changed to ${playing ? 'playing' : 'paused'} in room ${roomId}`);
    // Broadcast the player state to all other clients in the room
    socket.to(roomId).emit('player-state', { playing });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Clean up for the room this socket was in
    if (socket.currentRoom) {
      const room = rooms.get(socket.currentRoom);
      if (room) {
        // Remove participant
        room.participants.delete(socket.id);
        
        // Close and remove producers
        const producers = room.producers.get(socket.id);
        if (producers) {
          producers.forEach(({ producer }) => {
            console.log('Closing producer:', producer.id);
            producer.close();
          });
          room.producers.delete(socket.id);
        }
        
        // Notify other participants
        socket.to(socket.currentRoom).emit('participant-left', { socketId: socket.id });
        
        // Delete room if empty
        if (room.participants.size === 0) {
          console.log('Closing router for empty room:', socket.currentRoom);
          room.router.close();
          rooms.delete(socket.currentRoom);
          console.log('Room deleted:', socket.currentRoom);
        }
      }
    }
    
    // Close all producers
    socket.producers.forEach((producer) => {
      console.log('Closing producer on disconnect:', producer.id);
      producer.close();
    });
    
    // Close all consumers
    socket.consumers.forEach((consumer) => {
      console.log('Closing consumer on disconnect:', consumer.id);
      consumer.close();
    });
    
    // Close transports
    if (socket.transports.producer) {
      console.log('Closing producer transport');
      socket.transports.producer.close();
    }
    if (socket.transports.consumer) {
      console.log('Closing consumer transport');
      socket.transports.consumer.close();
    }
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  
  // Close all rooms and their routers
  rooms.forEach((room, roomId) => {
    console.log('Closing router for room:', roomId);
    room.router.close();
  });
  
  // Close worker
  if (worker) {
    console.log('Closing mediasoup worker');
    worker.close();
  }
  
  process.exit(0);
});
//roting for recommendation
app.use('/', preferenceSelection);

app.post("/getRecommendation", async (req, res) => {
  try {
    const { userId } = req.body;
    console.log("Received userId from frontend:", userId);

    const flaskResponse = await axios.post("http://localhost:4000/getRecommendation", {
      user_id: userId,
    });

    const recommendedMovieIds = flaskResponse.data.recommended_movie_ids;
    console.log("Recommended Movie IDs from Flask:", recommendedMovieIds);

    return res.status(200).json({ recommendedMovieIds });
  } catch (error) {
    console.error("Error in Node.js /getRecommendation route:", error.message);
    return res.status(500).json({ error: "Failed to get recommendations" });
  }
});

app.post('/analyze-mood', async (req, res) => {
  const { text, emoji, user_id } = req.body;

  try {
    // Call Flask backend
    const flaskResponse = await axios.post("http://localhost:4000/getMoodRecommendation", {
      text,
      emoji,
      user_id
    });

    // Extract and forward the recommended movie IDs
    const recommendedMovieIds = flaskResponse.data.movie_ids.map(id =>
      parseInt(id.split('.')[0]) // Convert '27710.0' to 27710
    );
    const genres = flaskResponse.data.ranked_genres;
    console.log("printing the Mood Movies ", recommendedMovieIds)
    res.json({ movie_ids: recommendedMovieIds, genres: genres });
  } catch (err) {
    console.error('Error in Node.js backend:', err.message);
    res.status(500).json({ error: 'Failed to analyze mood' });
  }
});

app.get('/test-cors', (req, res) => {
  res.json({ message: 'CORS test successful' });
});
// Start server
server.listen(5002, () => {
  console.log('Server + Socket.IO running on http://localhost:5002');
});