import { Room, DataPacket_Kind, RemoteParticipant, RemoteTrackPublication } from 'livekit-client';
import { useEffect, useRef, useState } from 'react';

export function useLiveKit(
  roomSid: string, // was roomName
  userId: string,  // was userName
  wsUrl: string,
  token: string
) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [dataMessages, setDataMessages] = useState<any[]>([]);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    if (!roomSid || !userId || !wsUrl || !token) return;
    let livekitRoom: Room | null = null;
    const join = async () => {
      livekitRoom = new Room();
      livekitRoom.on('participantConnected', (participant) => {
        console.log('[LIVEKIT] participantConnected:', participant.identity);
      });
      livekitRoom.on('participantDisconnected', (participant) => {
        console.log('[LIVEKIT] participantDisconnected:', participant.identity);
      });
      livekitRoom.on('connected', () => {
        console.log('[LIVEKIT] Room connected:', { roomSid, userId });
      });
      livekitRoom.on('disconnected', () => {
        console.log('[LIVEKIT] Room disconnected:', { roomSid, userId });
      });
      livekitRoom.on('dataReceived', (payload, participant, kind) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload));
          setDataMessages(prev => [...prev, { ...msg, participant, kind }]);
          console.log('[LIVEKIT] Data message received:', msg);
        } catch (e) {
          console.error('[LIVEKIT] Failed to parse data message:', e);
        }
      });
      try {
        await livekitRoom.connect(wsUrl, token);
        setRoom(livekitRoom);
        roomRef.current = livekitRoom;
        setIsConnected(true);
      } catch (err) {
        console.error('[LIVEKIT] Failed to connect:', err, { wsUrl, token, roomSid, userId });
      }
    };
    join();
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        setIsConnected(false);
      }
    };
  }, [roomSid, userId, wsUrl, token]);

  return { room, isConnected, dataMessages };
}
