import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { useLocation, useParams } from 'react-router-dom';
import * as mediasoupClient from 'mediasoup-client';
import YouTube from 'react-youtube';
import { Camera, CameraOff, Mic, MicOff, Users, Play, Pause } from 'lucide-react';
import axios from 'axios';
import { API_KEY } from '../Constants/Constance.js';

function PlaySharedMovie() {
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [participants, setParticipants] = useState({});
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const [localStream, setLocalStream] = useState(null);
  const [youtubeLink, setYoutubeLink] = useState('');
  const [isCreator, setIsCreator] = useState(false);
  const [currentHostId, setCurrentHostId] = useState(null); // New state for current host's socketId
  const [currentState, setCurrentState] = useState('paused');
  const [initialTime, setInitialTime] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const socketRef = useRef(null);
  const deviceRef = useRef(null);
  const producerTransportRef = useRef(null);
  const consumerTransportsRef = useRef({});
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const pendingConsumersRef = useRef({});
  const isProducingRef = useRef({ video: false, audio: false });
  const roomIdRef = useRef('');
  const { movieId } = useParams();
  const [copied, setCopied] = useState(false);
  const [joinerRoomId, setJoinerRoomId] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const JoinerRoom = location.state?.roomId;
    if (JoinerRoom) {
      console.log("JoinerRoom", JoinerRoom);
      setJoinerRoomId(true);
      setRoomId(JoinerRoom);
    }
  }, [location.state]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  useEffect(() => {
    socketRef.current = io('http://localhost:5002', { reconnection: true });
    axios
      .get(`https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${API_KEY}`)
      .then((response) => {
        const videos = response.data.results;
        const trailer = videos.find(
          (video) => video.type === 'Trailer' && video.site === 'YouTube'
        );
        if (trailer) {
          const youtubeUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
          setYoutubeLink(youtubeUrl);
        } else {
          console.log('No YouTube trailer found');
        }
      })
      .catch((error) => {
        console.error('Error fetching trailer:', error);
      });

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
        setParticipants((prev) => ({ ...prev, [socketId]: { username, stream: null, cameraEnabled: true, micEnabled: true } }));
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

    socketRef.current.on('host-changed', ({ newHostId }) => {
      console.log('Host changed, new host ID:', newHostId);
      setCurrentHostId(newHostId);
      setIsCreator(socketRef.current.id === newHostId);
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

    socketRef.current.on('toggle-camera', ({ socketId, cameraEnabled }) => {
      setParticipants((prev) => ({
        ...prev,
        [socketId]: { ...prev[socketId], cameraEnabled }
      }));
    });

    socketRef.current.on('toggle-mic', ({ socketId, micEnabled }) => {
      setParticipants((prev) => ({
        ...prev,
        [socketId]: { ...prev[socketId], micEnabled }
      }));
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
  }, [localStream, joined, isCameraOn]);

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
    const newRoomId = Math.random().toString(36).substring(2, 10).toUpperCase();
    console.log('Creating room:', newRoomId, 'with YouTube link:', youtubeLink);
    try {
      const response = await fetch('http://localhost:5002/create-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: newRoomId, youtubeLink, movieId }),
      });
      const data = await response.json();
      if (response.ok) {
        setRoomId(newRoomId);
        setIsCreator(true);
        setCurrentHostId(socketRef.current.id); // Set initial host
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
          setCurrentHostId(data.currentHostId); // Set current host from server
          setCurrentState(data.videoState);
          setInitialTime(data.videoTime);
          setParticipants((prev) => ({ ...prev, [socketRef.current.id]: { username, stream: localStream, cameraEnabled: true, micEnabled: true } }));

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
                  [socketId]: { username: participantUsername, stream: null, cameraEnabled: true, micEnabled: true } 
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
            const existing = prev[socketId] || { username: 'Unknown', cameraEnabled: true, micEnabled: true };
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

  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isCameraOn;
        setIsCameraOn(!isCameraOn);
        socketRef.current.emit('toggle-camera', { 
          roomId, 
          socketId: socketRef.current.id,
          cameraEnabled: !isCameraOn 
        });
      }
    }
  };

  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMicOn;
        setIsMicOn(!isMicOn);
        socketRef.current.emit('toggle-mic', { 
          roomId, 
          socketId: socketRef.current.id,
          micEnabled: !isMicOn 
        });
      }
    }
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

  const VideoFrame = ({ stream, username, isLocal = false, cameraEnabled = true, micEnabled = true, isHost = false }) => {
    const localVideoRef = useRef(null);

    useEffect(() => {
      if (isLocal && stream && localVideoRef.current) {
        console.log(`Assigning local stream for ${username}`);
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch((err) => {
          console.error(`Local video play error for ${username}:`, err);
          setError(`Local video playback failed: ${err.message}`);
        });
      }
    }, [stream, isLocal, cameraEnabled]);

    return (
      <div className="relative group">
        <div className="bg-gradient-to-br from-gray-900 to-black rounded-xl overflow-hidden border border-gray-800 shadow-2xl transform transition-all duration-300 hover:border-red-500/50">
          <div className="aspect-video relative">
            {cameraEnabled && stream ? (
              <video
                ref={isLocal ? localVideoRef : (video) => {
                  if (video && stream && video.srcObject !== stream) {
                    console.log(`Assigning stream for ${username}`);
                    video.srcObject = stream;
                    video.play().catch((err) => {
                      console.error(`Video play error for ${username}:`, err);
                      setError(`Video playback failed for ${username}: ${err.message}`);
                    });
                  }
                }}
                autoPlay
                playsInline
                muted={isLocal}
                className="w-full h-full object-cover"
                style={{ background: 'black' }}
              />
            ) : (
              <div className="w-full h-full bg-black flex items-center justify-center">
                <CameraOff className="w-12 h-12 text-gray-500" />
              </div>
            )}
            
            {/* Username and status overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              <div className="flex items-center justify-between">
                <span className="text-white font-medium text-sm">
                  {username} {isLocal && '(You)'} {isHost && '(Host)'}
                </span>
                <div className="flex space-x-2">
                  {!micEnabled && (
                    <div className="bg-red-600 rounded-full p-1">
                      <MicOff className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {!cameraEnabled && (
                    <div className="bg-red-600 rounded-full p-1">
                      <CameraOff className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Live indicator for local stream */}
            {isLocal && (
              <div className="absolute top-3 left-3">
                <div className="bg-red-600 px-2 py-1 rounded text-white text-xs font-bold flex items-center space-x-1">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span>LIVE</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!joined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-red-900/20 flex items-center justify-center p-4">
        {/* {error && (
            <div className="bg-red-900/40 border border-red-500 text-red-300 px-3 py-2 rounded-md mb-4 flex items-center text-sm">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></div>
              {error}
            </div>
          )} */}

          <div className="w-full max-w-md bg-black/40 backdrop-blur-lg rounded-2xl p-6 shadow-2xl text-sm leading-tight mx-auto">
            {/* Join Room Section */}
            {joinerRoomId && (
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-red-500" />
                  Join Watch Party
                </h2>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full p-3 bg-gray-900/50 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:border-red-500 focus:outline-none transition-colors"
                  />
                  <button
                    onClick={handleJoin}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-md transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    disabled={!username.trim() || !roomId.trim()}
                  >
                    Join Party
                  </button>
                </div>
              </div>
            )}
            {/* Create Room Section */}
            {!joinerRoomId && (
              <div className="mb-4">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center">
                <Users className="w-5 h-5 mr-2 text-red-500" />
                Create Watch Party
              </h2>
              <div className="space-y-3">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Your name"
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-400 focus:border-red-500 focus:outline-none transition-colors"
                />
                <button
                  onClick={createRoom}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-md transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  disabled={!username.trim()}
                >
                  Create Party
                </button>
              </div>
              </div>
            )}
          </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 py-4 mt-16">
        <div className="flex justify-between items-center">
          <div className="bg-gray-800 px-3 py-1 rounded-full flex items-center space-x-2">
            <span className="text-white text-sm font-large">Room: {roomId}</span>
            <button
              onClick={handleCopy}
              className="text-white hover:text-blue-400 focus:outline-none"
              title="Copy Room ID"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8l6 6v8a2 2 0 01-2 2h-2M8 16v2a2 2 0 002 2h6M8 16h8"
                />
              </svg>
            </button>
            {copied && <span className="text-green-400 text-xs">Copied!</span>}
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-gray-400">
              <Users className="w-4 h-4" />
              <span className="text-sm">{Object.keys(participants).length} watching</span>
            </div>
            {socketRef.current.id === currentHostId && (
              <div className="bg-red-600 px-3 py-1 rounded-full">
                <span className="text-white text-xs font-bold">HOST</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-0">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Video Player Section */}
          <div className="xl:col-span-2">
            <div className="bg-black/40 backdrop-blur-lg border border-gray-800 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center">
                  <Play className="w-5 h-5 mr-2 text-red-500" />
                  Now Playing
                </h2>
                <div className="flex items-center space-x-2">
                  {currentState === 'playing' ? (
                    <Play className="w-5 h-5 text-green-500" />
                  ) : (
                    <Pause className="w-5 h-5 text-gray-500" />
                  )}
                  <span className="text-sm text-gray-400 capitalize">{currentState}</span>
                </div>
              </div>
              <div className="rounded-xl overflow-hidden shadow-2xl">
                <YouTube
                  videoId={extractVideoId(youtubeLink)}
                  opts={{
                    height: '400',
                    width: '100%',
                    playerVars: {
                      autoplay: 0
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
            </div>
          </div>

          {/* Video Chat Section */}
          <div className="xl:col-span-1">
            <div className="bg-black/40 backdrop-blur-lg border border-gray-800 rounded-2xl p-6 shadow-2xl h-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center">
                  <Camera className="w-5 h-5 mr-2 text-red-500" />
                  Party Guests
                </h2>
                <div className="flex space-x-2">
                  <button
                    onClick={toggleCamera}
                    className={`p-3 rounded-full transition-all transform hover:scale-110 ${
                      isCameraOn 
                        ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                    title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
                  >
                    {isCameraOn ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={toggleMic}
                    className={`p-3 rounded-full transition-all transform hover:scale-110 ${
                      isMicOn 
                        ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                    title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
                  >
                    {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto pr-2 pl-1 custom-scrollbar">
                <VideoFrame
                  stream={localStream}
                  username={username}
                  isLocal={true}
                  cameraEnabled={isCameraOn}
                  micEnabled={isMicOn}
                  isHost={socketRef.current.id === currentHostId}
                />
                {Object.entries(participants).map(([socketId, { username: participantUsername, stream, cameraEnabled, micEnabled }]) => (
                  socketId !== socketRef.current?.id && (
                    <VideoFrame
                      key={socketId}
                      stream={stream}
                      username={participantUsername}
                      cameraEnabled={cameraEnabled}
                      micEnabled={micEnabled}
                      isHost={socketId === currentHostId}
                    />
                  )
                ))}
              </div>

              {Object.keys(participants).length === 0 && (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">Waiting for others to join...</p>
                  <p className="text-sm text-gray-500 mt-2">Share room ID: <span className="font-mono bg-gray-800 px-2 py-1 rounded">{roomId}</span></p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlaySharedMovie;