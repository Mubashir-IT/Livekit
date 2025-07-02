import { useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import wave from "../assets/wave.png";
import mic from "../assets/mic.png";
import caption from "../assets/caption.png";
import leave from "../assets/leave.png";
import { RoomContext } from "@/context/context";
import Helpers from "@/config/helpers";
import { useNavigate } from "react-router-dom";
import { useLiveKit } from '@/hooks/useLiveKit';
import { LocalAudioTrack } from 'livekit-client';

const API_BASE_URL = "http://localhost:3000/api/v1";

interface TranscriptionMessage {
  type: "transcription" | "caption";
  text: string;
  language: string;
  timestamp: number;
  isLocal: boolean;
  participantName: string;
}

// WAV audio encoder utility
class WAVEncoder {
  static encodeWAV(samples: Float32Array, sampleRate: number = 16000): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF'); // ChunkID
    view.setUint32(4, 36 + samples.length * 2, true); // ChunkSize
    writeString(8, 'WAVE'); // Format
    writeString(12, 'fmt '); // Subchunk1ID
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // AudioFormat (PCM)
    view.setUint16(22, 1, true); // NumChannels (mono)
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * 2, true); // ByteRate
    view.setUint16(32, 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    writeString(36, 'data'); // Subchunk2ID
    view.setUint32(40, samples.length * 2, true); // Subchunk2Size

    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i])); // Clamp to [-1, 1]
      view.setInt16(offset, sample * 0x7FFF, true); // Convert to 16-bit
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  static async processAudioBuffer(audioBuffer: AudioBuffer): Promise<Blob> {
    // Get audio data (use first channel if stereo)
    const audioData = audioBuffer.getChannelData(0);

    // Resample to 16kHz if needed
    const targetSampleRate = 16000;
    let samples: Float32Array;

    if (audioBuffer.sampleRate !== targetSampleRate) {
      samples = this.resample(audioData, audioBuffer.sampleRate, targetSampleRate);
    } else {
      samples = audioData;
    }

    return this.encodeWAV(samples, targetSampleRate);
  }

  static resample(audioData: Float32Array, originalSampleRate: number, targetSampleRate: number): Float32Array {
    if (originalSampleRate === targetSampleRate) {
      return audioData;
    }

    const sampleRateRatio = originalSampleRate / targetSampleRate;
    const newLength = Math.round(audioData.length / sampleRateRatio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const originalIndex = i * sampleRateRatio;
      const index = Math.floor(originalIndex);
      const fraction = originalIndex - index;

      if (index + 1 < audioData.length) {
        result[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction;
      } else {
        result[i] = audioData[index];
      }
    }

    return result;
  }
}

// Get user's selected language (default to 'en')
const userSelectedLanguage = localStorage.getItem("listenerLanguage") || "en";

const JoinPage = () => {
  const [captionText, setCaption] = useState<string>("");
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const chunkIndexRef = useRef<number>(0);
  const [messages, setMessages] = useState<TranscriptionMessage[]>([]);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const { roomId, role } = useContext(RoomContext);
  const navigate = useNavigate();
  const userLanguage = Helpers.getUserLanguage();

  // LiveKit integration state
  const [livekitReady, setLivekitReady] = useState(false);
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [livekitWsUrl, setLivekitWsUrl] = useState<string | null>(null);
  const [livekitRoomName, setLivekitRoomName] = useState<string | null>(null);
  const [livekitUserName, setLivekitUserName] = useState<string | null>(null);

  // Get user ID from token or context
  const getUserId = () => {
    const token = localStorage.getItem("token");
    if (!token) return null;

    try {
      // Decode JWT token to get user ID (adjust based on your token structure)
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId || payload.id || payload.sub;
    } catch (error) {
      console.error("Error decoding token:", error);
      return null;
    }
  };

  // Fetch LiveKit token and wsUrl when joining a room
  const joinLiveKit = async (roomId: string, userId: string) => {
    console.log('[LIVEKIT] joinLiveKit called', { roomId, userId });
    const response = await fetch('http://localhost:3000/api/v1/livekit/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, userId })
    });
    const data = await response.json();
    console.log('[LIVEKIT] joinLiveKit response:', data);
    if (data.success) {
      setLivekitToken(data.token);
      setLivekitWsUrl(data.wsUrl);
      setLivekitRoomName(roomId);
      setLivekitUserName(userId);
      console.log('[LIVEKIT] Token and wsUrl set:', { token: data.token, wsUrl: data.wsUrl });
    } else {
      console.error('[LIVEKIT] Failed to get token:', data);
    }
  };

  // For creator: set livekitReady only after mic is enabled and stream is ready
  useEffect(() => {
    const userData = Helpers.getUserData();
    if (role === 'creator' && isRecording && micStream && roomId && userData && (userData.id || userData.userId)) {
      setLivekitReady(true);
      console.log('[LIVEKIT] livekitReady set to true');
    }
  }, [role, isRecording, micStream, roomId]);

  // For listener: set livekitReady on page load or when userData is available
  useEffect(() => {
    const userData = Helpers.getUserData();
    if (role === 'listener' && roomId && userData && (userData.id || userData.userId)) {
      setLivekitReady(true);
      console.log('[LIVEKIT] livekitReady set to true (listener)');
    }
  }, [role, roomId, JSON.stringify(Helpers.getUserData())]);

  // Connect to LiveKit when ready and token not yet fetched
  useEffect(() => {
    const userData = Helpers.getUserData();
    const userId = userData && (userData.id || userData.userId);
    console.log('[LIVEKIT] joinLiveKit effect:', {
      livekitReady,
      roomId,
      userId,
      livekitToken
    });
    if (
      livekitReady &&
      roomId &&
      userId &&
      !livekitToken // Only fetch if not already fetched
    ) {
      console.log('[LIVEKIT] Calling joinLiveKit with:', { roomId, userId });
      joinLiveKit(roomId, userId);
    } else {
      console.log('[LIVEKIT] Not calling joinLiveKit:', {
        livekitReady,
        roomId,
        userId,
        livekitToken
      });
    }
  }, [livekitReady, roomId, livekitToken]);

  // Use the LiveKit hook
  console.log('[LIVEKIT] useLiveKit params:', { livekitRoomName, livekitUserName, livekitWsUrl, livekitToken });
  const { room: livekitRoom, isConnected: isLivekitConnected, dataMessages } = useLiveKit(
    livekitRoomName || '', // this is now roomSid
    livekitUserName || '', // this is now userId
    livekitWsUrl || '',
    livekitToken || ''
  );

  const captionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Listen for LiveKit caption data messages and update captions/messages
  useEffect(() => {
    if (!dataMessages || dataMessages.length === 0) return;
    const lastMsg = dataMessages[dataMessages.length - 1];
    // Only process captions for this user
    if (lastMsg.type === 'caption' && lastMsg.text && lastMsg.text.trim()) {
      // Remove old caption immediately
      setCaption("");
      setMessages([]); // Remove all old captions/messages
      if (captionTimeoutRef.current) clearTimeout(captionTimeoutRef.current);
      const myLanguage = localStorage.getItem("listenerLanguage") || "en";
      // Only listeners should play TTS audio
      if (role === 'listener') {
        fetch(`${API_BASE_URL}/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: lastMsg.text,
            targetLang: myLanguage,
            sourceLang: 'auto'
          })
        })
          .then(res => res.json())
          .then(data => {
            const translatedText = data.translatedText || lastMsg.text;
            setCaption(translatedText);
            setMessages([{ ...lastMsg, text: translatedText, language: myLanguage }]);
            captionTimeoutRef.current = setTimeout(() => setCaption(''), 5000);
            // Request TTS in listener's language
            fetch(`${API_BASE_URL}/audio/tts`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: translatedText, language: myLanguage })
            })
              .then(res => res.json())
              .then(ttsData => {
                if (ttsData.audioContent) {
                  const audio = new Audio(`data:audio/mp3;base64,${ttsData.audioContent}`);
                  audio.play();
                }
              });
          })
          .catch(() => {
            setCaption(lastMsg.text);
            setMessages([{ ...lastMsg, language: myLanguage }]);
            captionTimeoutRef.current = setTimeout(() => setCaption(''), 5000);
          });
      } else {
        // For creator or other roles, just show the caption in their language
        setCaption(lastMsg.text);
        setMessages([lastMsg]);
        captionTimeoutRef.current = setTimeout(() => setCaption(''), 5000);
      }
    }
  }, [dataMessages, livekitUserName]);

  // Listen for LiveKit TTS data messages and play TTS for listeners
  // (DISABLED: Only play TTS from /audio/tts endpoint to avoid double playback)
  // useEffect(() => {
  //   if (!dataMessages || dataMessages.length === 0) return;
  //   const lastMsg = dataMessages[dataMessages.length - 1];
  //   if (lastMsg.type === 'tts' && lastMsg.audioContent && role === 'listener') {
  //     try {
  //       // If the TTS message language does not match the listener's, optionally re-translate and re-TTS (future feature)
  //       console.log('TTS DEBUG: Received TTS data message. audioContent length:', lastMsg.audioContent.length, 'language:', lastMsg.language);
  //       const audioBlob = new Blob([
  //         Uint8Array.from(atob(lastMsg.audioContent), c => c.charCodeAt(0))
  //       ], { type: 'audio/mp3' });
  //       const audioUrl = URL.createObjectURL(audioBlob);
  //       const audio = new Audio(audioUrl);
  //       audio.onplay = () => console.log('TTS DEBUG: LiveKit audio playback started');
  //       audio.onerror = (e) => console.error('TTS DEBUG: LiveKit audio playback error', e);
  //       audio.play().catch(e => console.error('TTS DEBUG: LiveKit audio play() promise rejected', e));
  //     } catch (err) {
  //       console.error('TTS DEBUG: Error playing LiveKit TTS audio', err);
  //     }
  //   }
  // }, [dataMessages, role]);

  let isProcessingAudio = false;

  // When sending audio, always use the latest listenerLanguage if available
  const getTargetLanguageCode = () => {
    return localStorage.getItem("listenerLanguage") || userLanguage;
  };

  // Buffer audio chunks and only send to backend when a full segment is ready
  const bufferedChunksRef = useRef<Blob[]>([]);
  const bufferedChunkCount = 3; // Number of chunks to buffer before sending

  const processBufferedAudio = async () => {
    if (bufferedChunksRef.current.length === 0) return;
    // Combine buffered chunks into one Blob
    const combinedBlob = new Blob(bufferedChunksRef.current, { type: 'audio/wav' });
    await processAudioChunk(combinedBlob, chunkIndexRef.current, chunkIndexRef.current + 1);
    bufferedChunksRef.current = [];
    chunkIndexRef.current++;
  };

  const processAudioChunk = async (audioBlob: Blob, chunkIndex: number, totalChunks: number) => {
    if (isProcessingAudio) return;
    isProcessingAudio = true;
    const userId = getUserId();
    if (!userId || !roomId) {
      toast.error("Missing user or room information");
      isProcessingAudio = false;
      return;
    }

    try {
      setIsProcessing(true);
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      const response = await fetch(`${API_BASE_URL}/audio/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          userId,
          roomId,
          chunkIndex,
          totalChunks,
          audio: base64Audio,
          targetLanguageCode: getTargetLanguageCode(),
          audioFormat: 'wav' // Specify WAV format
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('AUDIO DEBUG: Backend response:', result);
      // Only show caption and play TTS if BOTH are present and non-empty
      if (result.text && result.text.trim() && result.audioContent) {
        // Only listeners should play TTS audio
        if (role === 'listener') {
          try {
            console.log('TTS DEBUG: Attempting to play TTS audio. audioContent length:', result.audioContent.length);
            const audioBlob = new Blob([
              Uint8Array.from(atob(result.audioContent), c => c.charCodeAt(0))
            ], { type: 'audio/mp3' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.onplay = () => console.log('TTS DEBUG: Audio playback started');
            audio.onerror = (e) => console.error('TTS DEBUG: Audio playback error', e);
            audio.play().catch(e => console.error('TTS DEBUG: Audio play() promise rejected', e));
          } catch (err) {
            console.error('TTS DEBUG: Error creating or playing audio', err);
          }
        } else {
          console.log('AUDIO DEBUG: Creator, skipping TTS playback.');
        }
        // Show caption for all roles
        const event = new CustomEvent("transcription", {
          detail: {
            text: result.text,
            language: result.language || userLanguage,
            isLocal: true,
            participantName: "You"
          }
        });
        window.dispatchEvent(event);
      } else {
        console.log('AUDIO DEBUG: No TTS or caption to play/show.');
      }
    } catch (error) {
      console.error("Error processing audio chunk:", error);
      toast.error("Failed to process audio: " + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
      isProcessingAudio = false;
    }
  };

  const stopSpeech = async () => {
    // Stop audio processing
    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({ type: 'stop' });
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    micStream?.getTracks().forEach(track => track.stop());

    // Process any remaining audio chunks
    if (audioChunksRef.current.length > 0) {
      try {
        // Combine all audio chunks
        const totalLength = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
        const combinedAudio = new Float32Array(totalLength);
        let offset = 0;

        for (const chunk of audioChunksRef.current) {
          combinedAudio.set(chunk, offset);
          offset += chunk.length;
        }

        // Create AudioBuffer and convert to WAV
        const sampleRate = 16000;
        const audioBuffer = new AudioContext().createBuffer(1, combinedAudio.length, sampleRate);
        audioBuffer.copyToChannel(combinedAudio, 0);

        const wavBlob = await WAVEncoder.processAudioBuffer(audioBuffer);
        await processAudioChunk(wavBlob, chunkIndexRef.current, chunkIndexRef.current + 1);
        audioChunksRef.current = [];
      } catch (error) {
        console.error("Error processing final chunk:", error);
      }
    }

    setIsRecording(false);
    setIsConnecting(false);
    chunkIndexRef.current = 0;
    setMicStream(null);
    toast.success("Recording stopped");
  };

  const startSpeech = async () => {
    if (role !== "creator") {
      return toast.error("Only creator can start recording");
    }
    console.log('AUDIO DEBUG: Starting speech, requesting mic...');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('AUDIO DEBUG: getUserMedia not supported');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream);
      console.log('AUDIO DEBUG: Mic stream started', stream);
      // Create AudioContext for processing (only one per session)
      if (audioContextRef.current) {
        await audioContextRef.current.close();
      }
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(stream);

      // --- AudioWorkletNode replacement for ScriptProcessorNode ---
      await audioContextRef.current.audioWorklet.addModule('/src/audio-processor.js');
      workletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'audio-processor');
      audioChunksRef.current = [];
      chunkIndexRef.current = 0;

      // Use explicit types for buffers
      let audioBuffer: Float32Array[] = [];
      let bufferSize = 0;
      const targetBufferSize = 32000; // 2 seconds at 16kHz      
      let overlapBuffer: Float32Array | null = null; // For 0.5s overlap
      const overlapSize = 8000; // 0.5 seconds at 16kHz
      let processBuffer: AudioBuffer | null = null;
      workletNodeRef.current!.port.onmessage = async (event) => {
        const inputData = event.data as Float32Array;
        // Copy audio data
        const chunk = new Float32Array(inputData);
        audioBuffer.push(chunk);
        bufferSize += chunk.length;

        // Process when we have enough data (approximately 2 seconds)
        if (bufferSize >= targetBufferSize) {
          try {
            // Combine chunks
            let combinedAudio = new Float32Array(bufferSize + (overlapBuffer ? overlapBuffer.length : 0));
            let offset = 0;
            // Prepend overlap from previous chunk
            if (overlapBuffer) {
              combinedAudio.set(overlapBuffer, offset);
              offset += overlapBuffer.length;
            }
            for (const bufferChunk of audioBuffer) {
              combinedAudio.set(bufferChunk, offset);
              offset += bufferChunk.length;
            }

            // Save last 0.5s for next overlap
            if (combinedAudio.length >= overlapSize) {
              overlapBuffer = combinedAudio.slice(combinedAudio.length - overlapSize);
            } else {
              overlapBuffer = combinedAudio.slice();
            }

            // Reuse AudioContext for buffer
            if (!audioContextRef.current) return;
            if (!processBuffer) {
              processBuffer = audioContextRef.current.createBuffer(1, combinedAudio.length, 16000);
            } else if (processBuffer.length !== combinedAudio.length) {
              processBuffer = audioContextRef.current.createBuffer(1, combinedAudio.length, 16000);
            }
            processBuffer.copyToChannel(combinedAudio, 0);
            const wavBlob = await WAVEncoder.processAudioBuffer(processBuffer);
            await processAudioChunk(wavBlob, chunkIndexRef.current, -1); // -1 indicates ongoing recording

            // Reset buffer
            audioBuffer = [];
            bufferSize = 0;
            chunkIndexRef.current++;
          } catch (error) {
            console.error("Error processing audio chunk:", error);
          }
        }
      };

      // Connect nodes
      sourceNodeRef.current.connect(workletNodeRef.current);
      workletNodeRef.current.connect(audioContextRef.current.destination);

      setIsRecording(true);
      setIsConnecting(false);
      toast.success("Recording started (WAV format)");

    } catch (error) {
      console.error("Error starting speech:", error);
      toast.error("Failed to start speech: " + (error instanceof Error ? error.message : String(error)));
      setIsConnecting(false);
    }
  };

  const handleMicClick = () => {
    if (role !== 'creator') {
      return toast.error("Only the creator can control mic");
    }

    if (isConnecting || isProcessing) {
      return toast.info("Please wait...");
    }

    if (isRecording) {
      stopSpeech();
    } else {
      startSpeech();
    }
  };

  const handleLeaveClick = async () => {
    if (isRecording) {
      await stopSpeech();
    }
    navigate("/");
    toast.info("Left the room");
  };

  const getMicButtonState = () => {
    if (role !== 'creator') {
      return { className: "w-9 h-9 opacity-40", disabled: true };
    }

    if (isConnecting || isProcessing) {
      return { className: "w-9 h-9 animate-pulse opacity-70", disabled: true };
    }

    if (isRecording) {
      return { className: "w-9 h-9 animate-pulse opacity-100", disabled: false };
    }

    return { className: "w-9 h-9 opacity-70 hover:opacity-100", disabled: false };
  };

  const displayCaptions = () => {
    // Show last 5 captions, newest last
    return messages.slice(-5).map((msg, idx) => (
      <div key={idx} style={{ marginBottom: 4 }}>{msg.text}</div>
    ));
  };
  const getStatusText = () => {
    if (isConnecting) return "Connecting...";
    if (isProcessing) return "🔄 Processing audio...";
    if (isRecording) return "🔴 Recording - Speak now (WAV)";
    return "Click microphone to start";
  };

  // Redirect if context is missing
  useEffect(() => {
    if (!roomId || !role) {
      console.warn('[JoinPage] Missing roomId or role, redirecting to dashboard.');
      navigate('/');
    }
  }, [roomId, role, navigate]);

  // Only run WebRTC setup if roomId and role are set
  useEffect(() => {
    if (!roomId || !role) return;
    console.log('[DEBUG] useEffect running', { roomId, role });
    // Remove all socket.io and WebRTC peer connection logic
    // Use LiveKit connection for audio publishing/subscribing
  }, [roomId, role]);

  // Only connect to LiveKit and publish audio after mic is enabled (creator)
  useEffect(() => {
    console.log('[LIVEKIT] Publish effect:', { role, isRecording, micStream, livekitRoom, isLivekitConnected });
    if (role === 'creator' && isRecording && micStream && livekitRoom && isLivekitConnected) {
      // Unpublish any existing audio track before publishing a new one
      const pubs = livekitRoom.localParticipant.getTrackPublications();
      pubs.forEach((pub) => {
        if (pub.track && pub.track.kind === 'audio') {
          // Only unpublish if it's a LocalTrack
          const localTrack = pub.track as any; // LocalTrack
          if (localTrack && typeof localTrack.stop === 'function') {
            console.log('[LIVEKIT][DEBUG] Unpublishing previous audio track:', pub.track.sid);
            livekitRoom.localParticipant.unpublishTrack(localTrack);
          }
        }
      });
      // Publish local audio to LiveKit (only once per mic start)
      const alreadyPublished = livekitRoom.localParticipant.getTrackPublications().some(pub => pub.track?.kind === 'audio');
      if (!alreadyPublished) {
        console.log('[LIVEKIT] Publishing audio track to LiveKit...');
        const audioTrack = new LocalAudioTrack(micStream.getAudioTracks()[0]);
        livekitRoom.localParticipant.publishTrack(audioTrack).then(pub => {
          console.log('[LIVEKIT][DEBUG] Audio track published:', {
            id: pub.track?.sid,
            muted: pub.track?.isMuted,
            kind: pub.track?.kind,
            pub,
          });
          // Log all local track publications after publishing
          const pubsAfter = livekitRoom.localParticipant.getTrackPublications();
          console.log('[LIVEKIT][DEBUG] Local track publications after publish:', pubsAfter.map(pub => ({
            kind: pub.track?.kind,
            id: pub.track?.sid,
            muted: pub.track?.isMuted,
          })));
        });
      } else {
        console.log('[LIVEKIT] Audio track already published.');
      }
    }
  }, [role, isRecording, micStream, livekitRoom, isLivekitConnected]);

  // Listener: subscribe to remote audio tracks after LiveKit is connected
  useEffect(() => {
    if (role === 'listener' && livekitRoom && isLivekitConnected) {
      // Log all remote participants and their tracks after connecting
      const remotes = Array.from(livekitRoom.remoteParticipants.values());
      console.log('[LIVEKIT][DEBUG] Remote participants after connect:', remotes.map((p) => {
        const participant = p as any;
        return {
          identity: participant.identity,
          tracks: participant.getTrackPublications().map((pub: any) => ({
            kind: pub.track?.kind,
            id: pub.track?.sid,
            muted: pub.track?.isMuted,
          }))
        };
      }));
      // Log all track publications for each remote participant
      remotes.forEach((p) => {
        const participant = p as any;
        participant.getTrackPublications().forEach((pub: any) => {
          console.log('[LIVEKIT][DEBUG] Remote participant track:', {
            participant: participant.identity,
            kind: pub.track?.kind,
            id: pub.track?.sid,
            muted: pub.track?.isMuted,
            pub,
          });
        });
      });
      // Listen for track subscription attempts
      livekitRoom.on('trackSubscriptionFailed', (trackSid, participant, reason) => {
        console.error('[LIVEKIT][DEBUG] Track subscription failed:', { trackSid, participant: participant.identity, reason });
      });
      livekitRoom.on('trackSubscribed', (track, _publication, participant) => {
        console.log('[LIVEKIT][DEBUG] trackSubscribed event:', {
          participant: participant.identity,
          kind: track.kind,
          id: track.sid,
          muted: track.isMuted,
        });
        if (track.kind === 'audio') {
          console.log('[LIVEKIT] Listener received audio track from:', participant.identity);
        }
      });
      // Reminder: Make sure you have the latest livekit-client package installed!
      // npm install livekit-client@latest
      livekitRoom.on('participantConnected', (participant) => {
        console.log('[LIVEKIT] Listener sees participant connected:', participant.identity);
        // Log all tracks for this participant
        participant.getTrackPublications().forEach((pub: any) => {
          console.log('[LIVEKIT][DEBUG] New participant track:', {
            participant: participant.identity,
            kind: pub.track?.kind,
            id: pub.track?.sid,
            muted: pub.track?.isMuted,
            pub,
          });
        });
      });
      livekitRoom.on('participantDisconnected', (participant) => {
        console.log('[LIVEKIT] Listener sees participant disconnected:', participant.identity);
      });
      // Log full room state after connection
      console.log('[LIVEKIT][DEBUG] Room state after connect:', {
        localParticipant: livekitRoom.localParticipant.identity,
        remoteParticipants: Array.from(livekitRoom.remoteParticipants.values()).map((p) => (p as any).identity),
        allParticipants: livekitRoom.remoteParticipants,
      });
    }
  }, [role, livekitRoom, isLivekitConnected]);

  // Creator: log when participants connect/disconnect and log full room state
  useEffect(() => {
    if (role === 'creator' && livekitRoom && isLivekitConnected) {
      livekitRoom.on('participantConnected', (participant) => {
        console.log('[LIVEKIT] Creator sees participant connected:', participant.identity);
        // Log all tracks for this participant
        participant.getTrackPublications().forEach((pub: any) => {
          console.log('[LIVEKIT][DEBUG] New participant track:', {
            participant: participant.identity,
            kind: pub.track?.kind,
            id: pub.track?.sid,
            muted: pub.track?.isMuted,
            pub,
          });
        });
      });
      livekitRoom.on('participantDisconnected', (participant) => {
        console.log('[LIVEKIT] Creator sees participant disconnected:', participant.identity);
      });
      // Log full room state after connection
      console.log('[LIVEKIT][DEBUG] Room state after connect:', {
        localParticipant: livekitRoom.localParticipant.identity,
        remoteParticipants: Array.from(livekitRoom.remoteParticipants.values()).map((p) => (p as any).identity),
        allParticipants: livekitRoom.remoteParticipants,
      });
    }
  }, [role, livekitRoom, isLivekitConnected]);

  // Add this state to keep track of remote audio tracks for listeners
  const [remoteAudioTracks, setRemoteAudioTracks] = useState<any[]>([]);

  // Collect remote audio tracks for listeners
  useEffect(() => {
    if (role !== 'listener' || !livekitRoom || !isLivekitConnected) return;
    const tracks: any[] = [];
    const remotes = Array.from(livekitRoom.remoteParticipants.values());
    remotes.forEach((participant) => {
      participant.getTrackPublications().forEach((pub: any) => {
        if (pub.track && pub.track.kind === 'audio') {
          tracks.push(pub.track);
        }
      });
    });
    setRemoteAudioTracks(tracks);
  }, [role, livekitRoom, isLivekitConnected, dataMessages]);

  const micState = getMicButtonState();

  return (
    <div className="min-h-screen w-full bg-[#F8F8F8] flex items-center justify-center">
      <div className="w-full max-w-5xl rounded-3xl bg-white p-4 md:p-10 mx-2 md:mx-auto my-8 flex flex-col">
        <div className="grid grid-cols-1 md:grid-cols-2 relative min-h-[500px]">
          <div className="bg-white flex flex-col items-center justify-between py-10 px-2 relative">
            <img src={wave} alt="wave" className="w-[260px] h-[260px] object-contain mt-6 mb-2 p-2" />

            <div className="md:hidden text-center my-6">
              <h2 className="text-xl font-bold text-[#1E60B6] mb-2">
                Live Caption ({Helpers.supportedLanguages.find(lang => lang.code === userLanguage)?.name})
              </h2>
              {showCaptions && (
                <div className="bg-gray-100 px-4 py-3 rounded-lg text-left min-h-[48px] max-h-[120px] overflow-y-auto">
                  {displayCaptions()}
                </div>
              )}
            </div>

            <div className="flex justify-center gap-20 mb-2 mt-8">
              <button onClick={handleMicClick} disabled={micState.disabled}>
                <img src={mic} alt="Mic" className={micState.className} />
              </button>
              <img
                src={caption}
                alt="Caption"
                className={`w-9 h-9 cursor-pointer transition-opacity ${showCaptions ? '' : 'opacity-30 grayscale'}`}
                title={showCaptions ? 'Hide Captions' : 'Show Captions'}
                onClick={() => setShowCaptions((prev) => !prev)}
              />
              <button onClick={handleLeaveClick}>
                <img src={leave} alt="Leave" className="w-9 h-9" />
              </button>
            </div>
          </div>

          <div className="hidden md:flex items-center justify-center pl-12">
            <div className="text-[#484848] max-w-md">
              <h2 className="text-xl font-bold text-[#1E60B6] mb-2">
                Live Caption ({Helpers.supportedLanguages.find(lang => lang.code === userLanguage)?.name})
              </h2>
              {showCaptions && (
                <div className="bg-gray-100 px-4 py-3 rounded-lg min-h-[48px] max-h-[120px] overflow-y-auto">
                  {displayCaptions()}
                </div>
              )}
              <div className="text-sm text-gray-500 mt-2">
                {getStatusText()}
              </div>
              {messages.length > 1 && (
                <div className="mt-4">
                  <div className="text-sm font-semibold mb-2">Recent Messages:</div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {messages.slice(-3).map((msg, i) => (
                      <div key={i} className="text-xs bg-gray-50 rounded px-2 py-1">
                        <strong>{msg.participantName}:</strong> {msg.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="hidden md:block absolute top-10 bottom-10 left-1/2 w-px bg-[#CBCBCB]" style={{ transform: "translateX(-50%)" }} />
        </div>

        {/* Hidden audio elements for remote tracks (listeners only, always muted) */}
        {role === 'listener' && remoteAudioTracks.map((track, idx) => (
          <audio
            key={idx}
            ref={el => {
              if (el && track) {
                track.attach(el);
                el.autoplay = true;
                el.muted = true; // Always mute original audio for listeners
                el.style.display = 'none';
              }
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default JoinPage;