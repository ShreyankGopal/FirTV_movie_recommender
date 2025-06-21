// src/Pages/WatchPlayer.jsx
import React, { useRef, useEffect } from 'react';
import YouTube from 'react-youtube';

export default function WatchPlayer({ videoUrl, socket, isCreator }) {
  const playerRef = useRef(null);

  // turn any watch?v=… or youtu.be/… into just the ID
  const videoId = React.useMemo(() => {
    if (!videoUrl) return '';
    const u = new URL(videoUrl);
    return u.searchParams.get('v') || u.pathname.split('/').pop();
  }, [videoUrl]);

  // EMIT creator controls
  const onStateChange = e => {
    if (!isCreator) return;
    const state = e.data;                     // -1,0,1,2…
    const time  = e.target.getCurrentTime();
    socket.emit('video-control', { state, time });
  };

  // RECEIVE peer controls
  useEffect(() => {
    if (!socket) return;
    socket.on('video-control', ({ state, time }) => {
      const p = playerRef.current.internalPlayer;
      switch(state) {
        case 1: p.seekTo(time, true).then(() => p.playVideo()); break;
        case 2: p.pauseVideo(); break;
        case 0: p.seekTo(time,true).then(() => p.stopVideo()); break;
      }
    });
    return () => socket.off('video-control');
  }, [socket]);

  return (
    <div className="w-full h-[60vh] bg-black rounded overflow-hidden">
      <YouTube
        videoId={videoId}
        ref={playerRef}
        opts={{ playerVars:{ autoplay:0, controls:1 } }}
        onStateChange={onStateChange}
        className="w-full h-full"
      />
    </div>
  );
}
