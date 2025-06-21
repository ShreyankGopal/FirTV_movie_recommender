import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import mediasoup from 'mediasoup';
import preferenceSelection from './PreferenceSelection.js';
import axios from 'axios';
import ratingUpdateRouter from './handleUserRating.js';
import { userRating } from './ratingStore.js';
import addMovieEmbeddingRouter from './addMovieEmbedding.js';
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const rooms = new Map();
const roomToMovieId = new Map();
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

let worker;

app.get('/getMovieId/:roomId', (req, res) => {
  const { roomId } = req.params;
  const movieId = roomToMovieId.get(roomId);
  if (movieId) {
    res.status(200).json({ movieId });
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});

(async () => {
  worker = await mediasoup.createWorker({
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
  });
  console.log('Mediasoup worker created');
})();

async function createRouterForRoom() {
  return await worker.createRouter({ mediaCodecs });
}

app.get('/play-together/:roomId', async (req, res) => {
  const { roomId } = req.params;
  if (rooms.has(roomId)) {
    res.status(200).json({ message: 'Room exists' });
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});

app.post('/create-room', async (req, res) => {
  const { roomId, youtubeLink, movieId } = req.body;
  if (!roomId || !youtubeLink) {
    return res.status(400).json({ error: 'Room ID and YouTube link required' });
  }
  if (rooms.has(roomId)) {
    return res.status(409).json({ error: 'Room already exists' });
  }

  try {
    const router = await createRouterForRoom();
    rooms.set(roomId, { 
      router, 
      participants: [], // Changed to array to track join order
      producers: new Map(),
      youtubeLink,
      currentHostId: null, // Track current host
      videoState: { state: 'paused', time: 0, timestamp: 0 }
    });
    roomToMovieId.set(roomId, movieId);
    console.log('Room created:', roomId, 'with YouTube link:', youtubeLink);
    res.status(201).json({ message: 'Room created', roomId });
  } catch (err) {
    console.error('Error creating room:', err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.transports = {};
  socket.producers = new Map();
  socket.consumers = new Map();

  socket.on('join-room', async ({ roomId, username }, callback) => {
    console.log('Join request for room:', roomId, 'by socket:', socket.id);

    let room = rooms.get(roomId);
    if (!room) {
      console.log('Creating room:', roomId, 'because it does not exist');
      try {
        const router = await createRouterForRoom();
        room = { 
          router, 
          participants: [],
          producers: new Map(),
          youtubeLink: '',
          currentHostId: null,
          videoState: { state: 'paused', time: 0, timestamp: 0 }
        };
        rooms.set(roomId, room);
      } catch (err) {
        console.error('Error creating room during join:', err);
        return callback({ error: 'Failed to create room' });
      }
    }

    // Add participant to array with join timestamp
    room.participants.push({ socketId: socket.id, username, joinTime: Date.now() });
    socket.join(roomId);
    socket.currentRoom = roomId;

    // Set first participant as host
    if (room.participants.length === 1) {
      room.currentHostId = socket.id;
    }

    const rtpCapabilities = room.router.rtpCapabilities;
    const existingProducers = room.participants.map(({ socketId, username }) => ({
      socketId,
      username,
      producers: (room.producers.get(socketId) || []).map(p => ({ id: p.id, kind: p.kind })),
    }));

    const currentTime = room.videoState.state === 'playing' ?
      room.videoState.time + (Date.now() - room.videoState.timestamp) / 1000 :
      room.videoState.time;

    callback({
      rtpCapabilities,
      existingProducers,
      youtubeLink: room.youtubeLink,
      isCreator: room.currentHostId === socket.id,
      currentHostId: room.currentHostId, // Include current host
      videoState: room.videoState.state,
      videoTime: currentTime
    });

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

      socket.producers.set(producer.id, producer);

      const producers = room.producers.get(socket.id) || [];
      producers.push({ id: producer.id, kind, producer });
      room.producers.set(socket.id, producers);

      console.log(`Producer created: ${producer.id} for kind ${kind} by ${socket.id}`);
      callback({ id: producer.id });

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

  socket.on('play-video', ({ roomId, time }) => {
    const room = rooms.get(roomId);
    if (room && room.currentHostId === socket.id) {
      room.videoState = { state: 'playing', time, timestamp: Date.now() };
      io.in(roomId).emit('play-video', { time });
    }
  });

  socket.on('pause-video', ({ roomId, time }) => {
    const room = rooms.get(roomId);
    if (room && room.currentHostId === socket.id) {
      room.videoState = { state: 'paused', time, timestamp: Date.now() };
      io.in(roomId).emit('pause-video', { time });
    }
  });

  socket.on('toggle-camera', ({ roomId, socketId, cameraEnabled }) => {
    const room = rooms.get(roomId);
    if (room) {
      io.in(roomId).emit('toggle-camera', { socketId, cameraEnabled });
    }
  });

  socket.on('toggle-mic', ({ roomId, socketId, micEnabled }) => {
    const room = rooms.get(roomId);
    if (room) {
      io.in(roomId).emit('toggle-mic', { socketId, micEnabled });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    if (socket.currentRoom) {
      const room = rooms.get(socket.currentRoom);
      if (room) {
        // Remove participant from array
        room.participants = room.participants.filter(p => p.socketId !== socket.id);
        const producers = room.producers.get(socket.id);
        if (producers) {
          producers.forEach(({ producer }) => {
            console.log('Closing producer:', producer.id);
            producer.close();
          });
          room.producers.delete(socket.id);
        }
        socket.to(socket.currentRoom).emit('participant-left', { socketId: socket.id });

        // Handle host succession
        if (room.currentHostId === socket.id && room.participants.length > 0) {
          // Select the next participant as host (first in remaining array)
          room.currentHostId = room.participants[0].socketId;
          console.log(`New host assigned: ${room.currentHostId} for room ${socket.currentRoom}`);
          io.in(socket.currentRoom).emit('host-changed', { newHostId: room.currentHostId });
        } else if (room.participants.length === 0) {
          roomToMovieId.delete(socket.currentRoom);
          console.log('Closing router for empty room:', socket.currentRoom);
          room.router.close();
          rooms.delete(socket.currentRoom);
          console.log('Room deleted:', socket.currentRoom);
        }
      }
    }

    socket.producers.forEach((producer) => {
      console.log('Closing producer on disconnect:', producer.id);
      producer.close();
    });

    socket.consumers.forEach((consumer) => {
      console.log('Closing consumer on disconnect:', consumer.id);
      consumer.close();
    });

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

process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  rooms.forEach((room, roomId) => {
    console.log('Closing router for room:', roomId);
    room.router.close();
  });
  if (worker) {
    console.log('Closing mediasoup worker');
    worker.close();
  }
  process.exit(0);
});

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
    const flaskResponse = await axios.post("http://localhost:4000/getMoodRecommendation", {
      text,
      emoji,
      user_id
    });

    const recommendedMovieIds = flaskResponse.data.movie_ids.map(id =>
      parseInt(id.split('.')[0])
    );
    const genres = flaskResponse.data.ranked_genres;
    console.log("printing the Mood Movies ", recommendedMovieIds);
    res.json({ movie_ids: recommendedMovieIds, genres: genres });
  } catch (err) {
    console.error('Error in Node.js backend:', err.message);
    res.status(500).json({ error: 'Failed to analyze mood' });
  }
});
app.post('/getWeatherRecommendation', async (req, res) => {
  console.log("Hi")
  const { lat, lon } = req.body;
  console.log(lat);
  console.log(lon);
  try {
    const flaskResponse = await axios.post('http://localhost:4000/getWeatherRecommendation', {
      lat,
      lon
    });

    const recommendedMovieIds = flaskResponse.data.movie_ids.map(id =>
      parseInt(id.split('.')[0])
    );
    const genres = flaskResponse.data.ranked_genres;
    const weather_condition = flaskResponse.data.weather_condition;
    const time_slot = flaskResponse.data.time_slot;

    res.json({
      weather_condition,
      time_slot,
      genres,
      movie_ids: recommendedMovieIds
    });
  } catch (err) {
    console.error('Error in weather recommendation:', err.message);
    res.status(500).json({ error: 'Failed to fetch weather-based recommendations' });
  }
});
app.get('/test-cors', (req, res) => {
  res.json({ message: 'CORS test successful' });
});
app.use('/',ratingUpdateRouter);
app.use('/', addMovieEmbeddingRouter);
server.listen(5002, () => {
  console.log('Server + Socket.IO running on http://localhost:5002');
});