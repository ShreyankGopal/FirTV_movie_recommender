import mediasoup from 'mediasoup';

let worker;
let router;
const peers = new Map();

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

    socket.on('getRtpCapabilities', (callback) => {
      callback(router.rtpCapabilities);
    });

    socket.on('createTransport', async (callback) => {
      const transport = await router.createWebRtcTransport({
        listenIps: [{ ip: '127.0.0.1', announcedIp: null }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true
      });

      peers.get(socket.id).transport = transport;
      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters
      });
    });

    socket.on('connectTransport', async ({ dtlsParameters }) => {
      await peers.get(socket.id).transport.connect({ dtlsParameters });
    });

    socket.on('produce', async ({ kind, rtpParameters }, callback) => {
      const producer = await peers.get(socket.id).transport.produce({
        kind,
        rtpParameters
      });
      peers.get(socket.id).producer = producer;
      callback({ id: producer.id });
    });

    socket.on('consume', async ({ producerId, rtpCapabilities }, callback) => {
      if (!router.canConsume({ producerId, rtpCapabilities })) {
        return callback({ error: 'Cannot consume' });
      }

      const consumer = await peers.get(socket.id).transport.consume({
        producerId,
        rtpCapabilities,
        paused: false
      });

      callback({
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters
      });
    });

    socket.on('disconnect', () => {
      const peer = peers.get(socket.id);
      if (peer?.producer) peer.producer.close();
      if (peer?.transport) peer.transport.close();
      peers.delete(socket.id);
    });
  });
}
