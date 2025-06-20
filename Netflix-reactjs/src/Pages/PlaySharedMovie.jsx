import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import YouTube from 'react-youtube';

function PlaySharedMovie() {
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [participants, setParticipants] = useState({});
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const [localStream, setLocalStream] = useState(null);
  const [youtubeLink, setYoutubeLink] = useState('');
  const [isCreator, setIsCreator] = useState(false);
  const [currentState, setCurrentState] = useState('paused');
  const [initialTime, setInitialTime] = useState(null);
  const socketRef = useRef(null);
  const deviceRef = useRef(null);
  const producerTransportRef = useRef(null);
  const consumerTransportsRef = useRef({});
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const pendingConsumersRef = useRef({});
  const isProducingRef = useRef({ video: false, audio: false });
  const roomIdRef = useRef('');

  useEffect(() => {
    socketRef.current = io('http://localhost:5002', { reconnection: true });

    if (!window.isSecureContext) {
      setError('This application requires a secure context (HTTPS or localhost).');
      return;
    }

    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      console.log('Available video devices:', videoDevices);
      const constraints = videoDevices.length > 0 ? { video: true, audio: true } : { video: { deviceId: videoDevices[0]?.deviceId }, audio: true };
      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          console.log('Local stream obtained:', stream);
          setLocalStream(stream);
        })
        .catch((err) => {
          console.error('Media access error:', err);
          if (err.name === 'NotReadableError' || err.name === 'NotAllowedError') {
            setError('Camera is in use by another tab or application. Please close other tabs or use a different device/profile.');
          } else {
            setError(`Failed to access camera/mic: ${err.message}. Please ensure permissions are granted.`);
          }
        });
    });

    socketRef.current.on('connect', () => {
      console.log('Socket connected:', socketRef.current.id);
    });

    socketRef.current.on('new-participant', async ({ socketId, username }) => {
      console.log('New participant joined:', socketId, 'Username:', username);
      if (socketId !== socketRef.current.id) {
        setParticipants((prev) => ({ ...prev, [socketId]: { username, stream: null } }));
        console.log(`Added participant ${username} to participants list, waiting for their streams`);
      }
    });

    socketRef.current.on('new-producer', async ({ producerId, socketId, kind }) => {
      console.log('New producer event received:', producerId, 'Kind:', kind, 'Socket:', socketId);
      if (socketId === socketRef.current.id) {
        console.log('Ignoring own producer');
        return;
      }

      const currentRoomId = roomIdRef.current;
      if (!currentRoomId) {
        console.error('No roomId available for consuming producer:', producerId);
        setError('Room connection lost. Please refresh and rejoin.');
        return;
      }

      try {
        if (!consumerTransportsRef.current[socketId]) {
          console.log(`Creating consumer transport for ${socketId} before consuming ${kind}`);
          await createConsumerTransport(socketId, currentRoomId);
        }
        console.log(`Consuming ${kind} from ${socketId}, producer: ${producerId}`);
        await consume(producerId, socketId, kind);
      } catch (err) {
        console.error(`Failed to handle new producer ${producerId} from ${socketId}:`, err);
        setError(`Failed to receive ${kind} stream: ${err.message}`);
      }
    });

    socketRef.current.on('participant-left', ({ socketId }) => {
      console.log('Participant left:', socketId);
      setParticipants((prev) => {
        const updated = { ...prev };
        delete updated[socketId];
        return updated;
      });
      if (consumerTransportsRef.current[socketId]) {
        consumerTransportsRef.current[socketId].close();
        delete consumerTransportsRef.current[socketId];
      }
      if (pendingConsumersRef.current[socketId]) {
        delete pendingConsumersRef.current[socketId];
      }
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setError('Failed to connect to server. Please check if the server is running.');
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        setError('Disconnected from server. Please refresh to reconnect.');
      }
    });

    return () => {
      console.log('Cleaning up...');
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      Object.values(consumerTransportsRef.current).forEach((transport) => transport.close());
      if (producerTransportRef.current) {
        producerTransportRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!joined) return;

    socketRef.current.on('play-video', ({ time }) => {
      setCurrentState('playing');
      if (!isCreator && playerRef.current) {
        playerRef.current.seekTo(time);
        playerRef.current.playVideo();
      }
    });

    socketRef.current.on('pause-video', ({ time }) => {
      setCurrentState('paused');
      if (!isCreator && playerRef.current) {
        playerRef.current.seekTo(time);
        playerRef.current.pauseVideo();
      }
    });

    return () => {
      socketRef.current.off('play-video');
      socketRef.current.off('pause-video');
    };
  }, [joined, isCreator]);

  useEffect(() => {
    if (localStream && videoRef.current) {
      console.log('Assigning local stream to video element:', videoRef.current);
      videoRef.current.srcObject = localStream;
      if (videoRef.current.paused) {
        videoRef.current.play().catch((err) => {
          console.error('Failed to play local video:', err);
          setError(`Local video playback failed: ${err.message}`);
        });
      }
    }
  }, [localStream, joined]);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  const createRoom = async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    if (!youtubeLink.trim()) {
      setError('Please enter a YouTube link');
      return;
    }
    if (!youtubeLink.includes('youtube.com') && !youtubeLink.includes('youtu.be')) {
      setError('Please enter a valid YouTube link');
      return;
    }
    const newRoomId = Math.random().toString(36).substring(2, 10);
    console.log('Creating room:', newRoomId, 'with YouTube link:', youtubeLink);
    try {
      const response = await fetch('http://localhost:5002/create-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: newRoomId, youtubeLink }),
      });
      const data = await response.json();
      if (response.ok) {
        setRoomId(newRoomId);
        setIsCreator(true);
        roomIdRef.current = newRoomId;
        await joinRoom(newRoomId);
      } else {
        setError(data.error);
        console.error('Create room error:', data.error);
      }
    } catch (err) {
      setError('Failed to create room');
      console.error('Create room fetch error:', err);
    }
  };

  const joinRoom = async (id) => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    roomIdRef.current = id;
    console.log('Joining room:', id);
    try {
      const response = await fetch(`http://localhost:5002/play-together/${id}`);
      if (!response.ok) {
        throw new Error('Room not found');
      }

      socketRef.current.emit('join-room', { roomId: id, username }, async (data) => {
        if (data.error) {
          setError(data.error);
          console.error('Join room error:', data.error);
          return;
        }

        try {
          deviceRef.current = new mediasoupClient.Device();
          await deviceRef.current.load({ routerRtpCapabilities: data.rtpCapabilities });
          console.log('Mediasoup device loaded');

          setJoined(true);
          setYoutubeLink(data.youtubeLink);
          setIsCreator(data.isCreator);
          setCurrentState(data.videoState);
          setInitialTime(data.videoTime);
          setParticipants((prev) => ({ ...prev, [socketRef.current.id]: { username, stream: localStream } }));

          await createProducerTransport(id);

          if (localStream && producerTransportRef.current) {
            await new Promise(resolve => setTimeout(resolve, 100));
            const videoTrack = localStream.getVideoTracks()[0];
            const audioTrack = localStream.getAudioTracks()[0];
            if (videoTrack && !isProducingRef.current.video) {
              await produce('video', id);
            }
            if (audioTrack && !isProducingRef.current.audio) {
              await produce('audio', id);
            }
          }

          if (data.existingProducers && data.existingProducers.length > 0) {
            console.log('Processing existing producers:', data.existingProducers);
            for (const { socketId, username: participantUsername, producers } of data.existingProducers) {
              if (socketId !== socketRef.current.id) {
                console.log(`Setting up consumption for existing participant: ${participantUsername} (${socketId})`);
                setParticipants((prev) => ({ 
                  ...prev, 
                  [socketId]: { username: participantUsername, stream: null } 
                }));
                try {
                  await createConsumerTransport(socketId, id);
                  for (const { id: producerId, kind } of producers) {
                    console.log(`Consuming existing producer: ${producerId} (${kind}) from ${socketId}`);
                    await consume(producerId, socketId, kind);
                  }
                } catch (err) {
                  console.error(`Failed to setup consumer for ${socketId}:`, err);
                  setError(`Failed to receive streams from ${participantUsername}: ${err.message}`);
                }
              }
            }
          }
        } catch (err) {
          setError(`Failed to join room: ${err.message}`);
          console.error('Room join setup error:', err);
        }
      });
    } catch (err) {
      setError(err.message);
      console.error('Join room fetch error:', err);
    }
  };

  const createProducerTransport = async (roomId) => {
    return new Promise((resolve, reject) => {
      socketRef.current.emit('create-producer-transport', { roomId }, async (data) => {
        if (data.error) {
          setError(data.error);
          console.error('Create producer transport error:', data.error);
          reject(new Error(data.error));
          return;
        }
        try {
          producerTransportRef.current = deviceRef.current.createSendTransport(data);

          producerTransportRef.current.on('connect', ({ dtlsParameters }, callback, errback) => {
            console.log('Producer transport connecting...');
            socketRef.current.emit('connect-transport', { 
              roomId, 
              transportId: data.id, 
              dtlsParameters 
            }, (response) => {
              if (response.error) {
                console.error('Producer transport connect error:', response.error);
                setError(`Transport connection failed: ${response.error}`);
                errback(new Error(response.error));
              } else {
                console.log('Producer transport connected successfully');
                callback();
              }
            });
          });

          producerTransportRef.current.on('produce', ({ kind, rtpParameters }, callback, errback) => {
            console.log(`Producing ${kind}...`);
            socketRef.current.emit('produce', { 
              roomId, 
              kind, 
              rtpParameters, 
              transportId: data.id 
            }, (response) => {
              if (response.error) {
                console.error(`Produce ${kind} error:`, response.error);
                setError(`Failed to share ${kind}: ${response.error}`);
                errback(new Error(response.error));
              } else {
                console.log(`Successfully produced ${kind}:`, response.id);
                isProducingRef.current[kind] = true;
                callback(response);
              }
            });
          });

          console.log('Producer transport created:', data.id);
          resolve();
        } catch (err) {
          console.error('Create producer transport error:', err);
          setError(`Failed to create producer transport: ${err.message}`);
          reject(err);
        }
      });
    });
  };

  const createConsumerTransport = async (socketId, roomId) => {
    if (!roomId) {
      console.error('No roomId provided for creating consumer transport for socket:', socketId);
      throw new Error('Room ID is not set');
    }

    if (consumerTransportsRef.current[socketId]) {
      console.log('Consumer transport already exists for socket:', socketId);
      return consumerTransportsRef.current[socketId];
    }

    return new Promise((resolve, reject) => {
      socketRef.current.emit('create-consumer-transport', { roomId }, async (data) => {
        if (data.error) {
          console.error('Create consumer transport error for socket:', socketId, 'Error:', data.error);
          setError(`Failed to create consumer transport: ${data.error}`);
          reject(new Error(data.error));
          return;
        }
        try {
          const transport = deviceRef.current.createRecvTransport(data);
          consumerTransportsRef.current[socketId] = transport;

          transport.on('connect', ({ dtlsParameters }, callback, errback) => {
            console.log('Consumer transport connecting for socket:', socketId);
            socketRef.current.emit('connect-transport', {
              roomId,
              transportId: data.id,
              dtlsParameters,
            }, (response) => {
              if (response.error) {
                console.error('Consumer transport connection failed for socket:', socketId, 'Error:', response.error);
                setError(`Consumer transport connection failed: ${response.error}`);
                errback(new Error(response.error));
              } else {
                console.log('Consumer transport connected for socket:', socketId);
                callback();
              }
            });
          });

          console.log('Consumer transport created for socket:', socketId, 'Transport ID:', data.id);
          resolve(transport);
        } catch (err) {
          console.error('Create consumer transport error for socket:', socketId, 'Error:', err);
          setError(`Failed to create consumer transport: ${err.message}`);
          reject(err);
        }
      });
    });
  };

  const produce = async (kind, roomId) => {
    if (!localStream) {
      console.error('No local stream available for producing');
      setError('No local stream available');
      return;
    }
    if (!producerTransportRef.current) {
      console.error('No producer transport available');
      setError('Producer transport not initialized');
      return;
    }

    if (isProducingRef.current[kind]) {
      console.log(`Already producing ${kind}, skipping`);
      return;
    }

    const track = kind === 'video' ? localStream.getVideoTracks()[0] : localStream.getAudioTracks()[0];
    if (track) {
      try {
        console.log(`Starting to produce ${kind} track:`, track.id);
        const producer = await producerTransportRef.current.produce({ track });
        console.log(`Producer created for ${kind}:`, producer.id);
        isProducingRef.current[kind] = true;
      } catch (err) {
        console.error(`Error producing ${kind}:`, err);
        setError(`Failed to share ${kind}: ${err.message}`);
      }
    } else {
      console.error(`No ${kind} track available`);
      setError(`No ${kind} track available in your stream`);
    }
  };

  const consume = async (producerId, socketId, kind) => {
    const currentRoomId = roomIdRef.current;
    if (!currentRoomId) {
      console.error('No roomId available for consuming producer:', producerId);
      setError('Room connection lost. Please refresh and rejoin.');
      return;
    }

    if (!consumerTransportsRef.current[socketId]) {
      console.error('No consumer transport for socket:', socketId, 'producer:', producerId);
      if (!pendingConsumersRef.current[socketId]) {
        pendingConsumersRef.current[socketId] = [];
      }
      pendingConsumersRef.current[socketId].push({ producerId, kind });
      console.log(`Queued consume request for socket ${socketId}, producer ${producerId}`);
      return;
    }

    console.log('Starting consume for producer:', producerId, 'socket:', socketId, 'kind:', kind);

    return new Promise((resolve, reject) => {
      socketRef.current.emit('consume', { 
        roomId: currentRoomId, 
        producerId, 
        rtpCapabilities: deviceRef.current.rtpCapabilities 
      }, async (data) => {
        if (data.error) {
          console.error('Consume error for producer:', producerId, 'Error:', data.error);
          setError(`Failed to receive ${kind} stream: ${data.error}`);
          reject(new Error(data.error));
          return;
        }
        try {
          const consumer = await consumerTransportsRef.current[socketId].consume({
            id: data.id,
            producerId: data.producerId,
            kind: data.kind,
            rtpParameters: data.rtpParameters,
          });

          console.log('Consumer created:', consumer.id, 'for producer:', producerId, 'kind:', kind);

          setParticipants((prev) => {
            const existing = prev[socketId] || { username: 'Unknown' };
            let existingStream = existing.stream;

            if (!existingStream) {
              existingStream = new MediaStream();
            }

            const existingTracks = existingStream.getTracks().filter(t => t.kind === kind);
            existingTracks.forEach(track => {
              existingStream.removeTrack(track);
              track.stop();
            });

            existingStream.addTrack(consumer.track);

            console.log(`Updated stream for ${existing.username} (${socketId}) with ${kind} track`);

            return {
              ...prev,
              [socketId]: { ...existing, stream: existingStream },
            };
          });

          socketRef.current.emit('resume-consumer', { consumerId: data.id }, (response) => {
            if (response.error) {
              console.error('Resume consumer error:', response.error);
              setError(`Failed to resume ${kind} stream: ${response.error}`);
              reject(new Error(response.error));
            } else {
              console.log('Consumer resumed for:', data.id);
              resolve(consumer);
            }
          });
        } catch (err) {
          console.error('Consume error for producer:', producerId, 'Error:', err);
          setError(`Failed to receive ${kind} stream: ${err.message}`);
          reject(err);
        }
      });
    });
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (roomId.trim() && username.trim()) {
      setIsCreator(false);
      joinRoom(roomId.trim());
    } else {
      setError('Please enter both a room ID and a username');
    }
  };

  const extractVideoId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {!joined ? (
        <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-4">Video Conference</h1>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          <div className="mb-6">
            <h2 className="text-xl mb-2">Join Existing Room</h2>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter Username"
              className="w-full p-2 border rounded mb-2"
              onKeyPress={(e) => e.key === 'Enter' && handleJoin(e)}
            />
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter Room ID"
              className="w-full p-2 border rounded mb-2"
              onKeyPress={(e) => e.key === 'Enter' && handleJoin(e)}
            />
            <button
              onClick={handleJoin}
              className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition-colors"
              disabled={!username.trim() || !roomId.trim()}
            >
              Join Room
            </button>
          </div>
          <div>
            <h2 className="text-xl mb-2">Or Create New Room</h2>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter Username"
              className="w-full p-2 border rounded mb-2"
            />
            <input
              type="text"
              value={youtubeLink}
              onChange={(e) => setYoutubeLink(e.target.value)}
              placeholder="Enter YouTube Link"
              className="w-full p-2 border rounded mb-2"
            />
            <button
              onClick={createRoom}
              className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 transition-colors"
              disabled={!username.trim() || !youtubeLink.trim()}
            >
              Create New Room
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Room: {roomId}</h1>
            <div className="text-sm text-gray-600">
              {Object.keys(participants).length} participant(s)
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-bold mb-2">Watch Video</h2>
              <YouTube
                videoId={extractVideoId(youtubeLink)}
                opts={{
                  height: '390',
                  width: '640',
                  playerVars: {
                    autoplay: 0,
                    controls: isCreator ? 1 : 2, // 1 for creator (full controls), 2 for non-creators (volume only)
                  },
                }}
                onReady={(event) => {
                  playerRef.current = event.target;
                  if (initialTime !== null) {
                    playerRef.current.seekTo(initialTime);
                    if (currentState === 'playing') {
                      playerRef.current.playVideo();
                    } else {
                      playerRef.current.pauseVideo();
                    }
                    setInitialTime(null);
                  }
                }}
                onPlay={() => {
                  if (isCreator) {
                    socketRef.current.emit('play-video', { roomId, time: playerRef.current.getCurrentTime() });
                  }
                }}
                onPause={() => {
                  if (isCreator) {
                    socketRef.current.emit('pause-video', { roomId, time: playerRef.current.getCurrentTime() });
                  }
                }}
              />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">Video Chat</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg shadow-md">
                  <h3 className="text-lg font-semibold mb-2 text-green-600">
                    You ({username})
                  </h3>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full rounded aspect-video object-cover"
                    style={{ background: 'black' }}
                  />
                </div>
                {Object.entries(participants).map(([socketId, { username: participantUsername, stream }]) => (
                  socketId !== socketRef.current?.id && (
                    <div key={socketId} className="bg-white p-4 rounded-lg shadow-md">
                      <h3 className="text-lg font-semibold mb-2">
                        {participantUsername}
                        {!stream && <span className="text-yellow-600 text-sm ml-2">(Connecting...)</span>}
                      </h3>
                      <video
                        autoPlay
                        playsInline
                        ref={(video) => {
                          if (video && stream) {
                            console.log(`Assigning stream for ${participantUsername} (${socketId})`);
                            if (video.srcObject !== stream) {
                              video.srcObject = stream;
                              video.play().catch((err) => {
                                console.error(`Video play error for ${participantUsername}:`, err);
                              });
                            }
                          }
                        }}
                        className="w-full rounded aspect-video object-cover"
                        style={{ background: 'black' }}
                      />
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlaySharedMovie;