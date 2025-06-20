import mediasoup from 'mediasoup';

let worker;
let router;
const peers = new Map(); // socketId => { socket, transport, producer, roomId }
const rooms = new Map(); // roomId => Set(socketIds)

export async function startMediasoup(io) {
  worker = await mediasoup.createWorker();
  router = await worker.createRouter({
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000
      }
    ]
  });

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);
    peers.set(socket.id, { socket });
    console.log('Peers:', peers);
    // --- Join Room ---
    socket.on('joinRoom', async ({ roomId }, callback) => {
        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }
        console.log("peers before join room", peers);
        const room = rooms.get(roomId);
        room.add(socket.id);
        peers.get(socket.id).roomId = roomId;
        console.log("peers after join room", peers);
        // Get all existing producers in the room
        const existingProducers = [];
        const existingPeers = [];
        room.forEach(peerId => {
          if (peerId !== socket.id) {
            existingPeers.push(peerId); // Track existing peer IDs
            const peer = peers.get(peerId);
            if (peer?.producer) {
              existingProducers.push({
                producerId: peer.producer.id,
                socketId: peerId
              });
            }
          }
        });
      
        // Notify other peers about the new peer
        room.forEach(peerId => {
          if (peerId !== socket.id && peers.has(peerId)) {
            peers.get(peerId).socket.emit('newPeer', {
              peerId: socket.id
            });
          }
        });
      
        callback({ 
          routerRtpCapabilities: router.rtpCapabilities,
          existingProducers,
          existingPeers // Include existing peers in the response
        });
      });

    // --- Create Transport ---
    socket.on('createTransport', async (data, callback) => {
        try {
          if (typeof data === 'function') {
            callback = data; // For backward compatibility
            data = { type: 'send' }; // Default to send transport
          }
      
          if (typeof callback !== 'function') {
            console.error('createTransport called without a callback');
            return;
          }
      
          const transport = await router.createWebRtcTransport({
            listenIps: [{ ip: '127.0.0.1', announcedIp: null }],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true
          });
      
          // Store the transport
          const peer = peers.get(socket.id) || { socket };
          if (data.type === 'recv') {
            peer.recvTransport = transport;
          } else {
            peer.sendTransport = transport;
          }
          peers.set(socket.id, peer);
      
          callback({
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters
          });
        } catch (error) {
          console.error('Error in createTransport:', error);
          if (typeof callback === 'function') {
            callback({ error: error.message });
          }
        }
      });

    // --- Connect Transport ---
    // --- Connect Transport ---
socket.on('connectTransport', async ({ dtlsParameters, transportId }, callback) => {
    try {
      const peer = peers.get(socket.id);
      if (!peer) {
        throw new Error('Peer not found');
      }
  
      // Find the transport by ID
      let transport;
      if (peer.sendTransport?.id === transportId) {
        transport = peer.sendTransport;
      } else if (peer.recvTransport?.id === transportId) {
        transport = peer.recvTransport;
      } else {
        throw new Error('Transport not found');
      }
  
      if (!transport) {
        throw new Error('Transport not initialized');
      }
  
      await transport.connect({ dtlsParameters });
      
      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (error) {
      console.error('Error connecting transport:', error);
      if (typeof callback === 'function') {
        callback({ error: error.message });
      }
    }
  });

    // --- Produce ---
    // --- Produce ---
socket.on('produce', async ({ kind, rtpParameters, transportId }, callback) => {
    try {
      const peer = peers.get(socket.id);
      if (!peer) {
        throw new Error('Peer not found');
      }
  
      // Find the transport by ID
      let transport;
      if (peer.sendTransport?.id === transportId) {
        transport = peer.sendTransport;
      } else if (peer.recvTransport?.id === transportId) {
        transport = peer.recvTransport;
      } else {
        throw new Error('Transport not found');
      }
  
      if (!transport) {
        throw new Error('Transport not initialized');
      }
  
      const producer = await transport.produce({ kind, rtpParameters });
      
      // Store the producer in the peer
      peer.producer = producer;
  
      const roomId = peer.roomId;
      if (!roomId) {
        throw new Error('Peer not in a room');
      }
  
      const members = rooms.get(roomId);
      if (!members) {
        throw new Error('Room not found');
      }
  
      // Notify other peers in room
      members.forEach((id) => {
        if (id !== socket.id && peers.has(id)) {
          peers.get(id).socket.emit('newProducer', {
            producerId: producer.id,
            socketId: socket.id
          });
        }
      });
  
      if (typeof callback === 'function') {
        callback({ id: producer.id });
      }
    } catch (error) {
      console.error('Error in produce:', error);
      if (typeof callback === 'function') {
        callback({ error: error.message });
      }
    }
  });

    // --- Consume ---
    // --- Consume ---
// --- Consume ---
socket.on('consume', async ({ producerId, rtpCapabilities, socketId }, callback) => {
    try {
      console.log('Consume request:', { producerId, consumerSocketId: socket.id, producerSocketId: socketId });
      
      // Get the producer's peer
      const producerPeer = peers.get(socketId);
      if (!producerPeer) {
        const error = `Producer peer not found: ${socketId}`;
        console.error(error);
        return callback({ error });
      }
  
      // Get the consumer's peer (current socket)
      const consumerPeer = peers.get(socket.id);
      if (!consumerPeer) {
        const error = `Consumer peer not found: ${socket.id}`;
        console.error(error);
        return callback({ error });
      }
  
      // Get the producer from the producer's peer
      const producer = producerPeer.producer;
      if (!producer) {
        const error = `Producer not found for peer: ${socketId}`;
        console.error(error);
        return callback({ error });
      }
  
      // Use the receive transport of the consumer peer
      const transport = consumerPeer.recvTransport;
      if (!transport) {
        const error = `No receive transport for consumer peer: ${socket.id}`;
        console.error(error);
        return callback({ error });
      }
  
      // Check if we can consume
      if (!router.canConsume({
        producerId: producer.id,
        rtpCapabilities
      })) {
        const error = 'Cannot consume - incompatible capabilities';
        console.error(error, {
          producerId: producer.id,
          consumerRtpCapabilities: rtpCapabilities
        });
        return callback({ error });
      }
  
      // Create the consumer
      const consumer = await transport.consume({
        producerId: producer.id,
        rtpCapabilities,
        paused: false
      });
  
      console.log('Consumer created:', {
        consumerId: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind
      });
  
      // Store the consumer
      if (!consumerPeer.consumers) {
        consumerPeer.consumers = new Map();
      }
      consumerPeer.consumers.set(producer.id, consumer);
  
      // Handle consumer events
      consumer.on('transportclose', () => {
        console.log('Consumer transport closed');
        consumerPeer.consumers?.delete(producer.id);
      });
  
      consumer.on('producerclose', () => {
        console.log('Producer closed, removing consumer');
        consumerPeer.consumers?.delete(producer.id);
        // Notify client to remove the consumer
        socket.emit('producerClosed', { producerId: producer.id });
      });
  
      callback({
        id: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters
      });
  
    } catch (error) {
      const errorMsg = `Error in consume: ${error.message}`;
      console.error(errorMsg, error);
      callback({ error: errorMsg });
    }
  });
    // --- Resume Consumer ---
    // --- Resume Consumer ---
socket.on('resumeConsumer', async ({ consumerId }, callback) => {
    try {
      const peer = peers.get(socket.id);
      if (!peer) {
        console.error('Peer not found for socket:', socket.id);
        if (typeof callback === 'function') {
          callback({ error: 'Peer not found' });
        }
        return;
      }
  
      // Find the consumer in the peer's consumers map
      let targetConsumer;
      for (const [id, consumer] of peer.consumers || []) {
        if (id === consumerId) {
          targetConsumer = consumer;
          break;
        }
      }
  
      if (!targetConsumer) {
        const errorMsg = `Consumer not found: ${consumerId}`;
        console.error(errorMsg);
        if (typeof callback === 'function') {
          callback({ error: errorMsg });
        }
        return;
      }
  
      await targetConsumer.resume();
      console.log(`Resumed consumer ${consumerId} for peer ${socket.id}`);
      
      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (error) {
      const errorMsg = `Error resuming consumer: ${error.message}`;
      console.error(errorMsg, error);
      if (typeof callback === 'function') {
        callback({ error: errorMsg });
      }
    }
  });

    // --- Disconnect ---
    socket.on('disconnect', () => {
        const peer = peers.get(socket.id);
        if (peer?.producer) peer.producer.close();
        if (peer?.transport) peer.transport.close();
      
        const roomId = peer?.roomId;
        if (roomId && rooms.has(roomId)) {
          rooms.get(roomId).delete(socket.id);
          // Notify other peers in the room about disconnection
          rooms.get(roomId).forEach(peerId => {
            if (peers.has(peerId)) {
              peers.get(peerId).socket.emit('peerDisconnected', {
                peerId: socket.id
              });
            }
          });
          if (rooms.get(roomId).size === 0) {
            rooms.delete(roomId);
          }
        }
      
        peers.delete(socket.id);
      });
  });
}
