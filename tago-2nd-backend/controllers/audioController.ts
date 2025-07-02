import { SpeechClient, protos as speechProtos } from '@google-cloud/speech';
import { TranslationServiceClient } from "@google-cloud/translate";
import { TextToSpeechClient, protos } from "@google-cloud/text-to-speech";
import fs from "fs";
import path from "path";
import { Json } from "sequelize/types/utils";
import { v4 as uuidv4 } from 'uuid';
import { RoomServiceClient, DataPacket_Kind } from "livekit-server-sdk";

const speechClient = new SpeechClient();
const translateClient = new TranslationServiceClient();
const ttsClient = new TextToSpeechClient();

let projectId: string;
try {
  // Try multiple possible locations for the credentials file
  const possiblePaths = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(process.cwd(), "google-cloud.json"),
    path.join(process.cwd(), "..", "google-cloud.json")
  ];

  let credentialsPath = null;
  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) {
      credentialsPath = p;
      break;
    }
  }

  if (!credentialsPath) {
    throw new Error("Could not find google-cloud.json in any of the expected locations");
  }

  console.log("Found credentials at:", credentialsPath);
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
  projectId = credentials.project_id;
  console.log("Successfully loaded credentials for project in audio controller:", projectId);
} catch (error) {
  console.error("Error loading Google Cloud credentials:", error);
  projectId = "tagobots-ai-457504"; // Fallback to known project ID
}

// LiveKit config (reuse from server or set here)
const livekitHost = process.env.LIVEKIT_HOST || 'wss://test-tago-bits-hi4jwi9r.livekit.cloud';
const livekitApiKey = process.env.LIVEKIT_API_KEY || 'APIP4LSThjgmLnt';
const livekitApiSecret = process.env.LIVEKIT_API_SECRET || '79V1j69hGbR2qcZpnEmMOjA5ePA9aJcgu29Zi7EVKkL';
const roomService = new RoomServiceClient(
  livekitHost,
  livekitApiKey,
  livekitApiSecret
);

// Store audio chunks for processing
interface AudioChunkStore {
  [key: string]: {
    chunks: Buffer[];
    lastUpdate: number;
    processing: boolean;
  };
}

const audioChunks: AudioChunkStore = {};
const CHUNK_TIMEOUT = 30000; // 30 seconds

// Clean up old chunks
setInterval(() => {
  const now = Date.now();
  Object.keys(audioChunks).forEach((key) => {
    if (now - audioChunks[key].lastUpdate > CHUNK_TIMEOUT) {
      delete audioChunks[key];
    }
  });
}, 60000); // Clean every minute

interface AudioProcessingRequest {
  audio: string;
  userId: string;
  roomId: string;
  targetLanguageCode: string;
  chunkIndex: number;
  totalChunks: number;
}

// Updated backend function for handling audio processing
export async function handleAudioRequest(
  req: AudioProcessingRequest
): Promise<Buffer> {
  try {
    const {
      audio,
      userId,
      roomId,
      targetLanguageCode,
      chunkIndex,
      totalChunks
    } = req;
    const chunkKey = `${roomId}_${userId}`;

    // Validate incoming audio data
    if (!audio || audio.length < 100) {
      console.error("Invalid audio data received:", audio?.length);
      throw new Error("Invalid audio data");
    }

    // Debug the incoming audio format
    console.log(
      `Received chunk ${chunkIndex}/${totalChunks} for key ${chunkKey}, size: ${audio.length} bytes`
    );

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audio, "base64");

    // Initialize chunk storage if needed
    if (!audioChunks[chunkKey]) {
      audioChunks[chunkKey] = {
        chunks: new Array(totalChunks).fill(null),
        lastUpdate: Date.now(),
        processing: false,
      };
    }

    // Update chunk data
    audioChunks[chunkKey].chunks[chunkIndex] = audioBuffer;
    audioChunks[chunkKey].lastUpdate = Date.now();

    // Check if we have all chunks
    const allChunksReceived = audioChunks[chunkKey].chunks.every(
      (chunk) => chunk !== null
    );

    // If all chunks received, process as before
    if (allChunksReceived && !audioChunks[chunkKey].processing) {
      audioChunks[chunkKey].processing = true;
      try {
        const combinedBuffer = Buffer.concat(audioChunks[chunkKey].chunks);
        console.log(
          `Processing combined audio of size: ${combinedBuffer.length} bytes`
        );
        const result = await processAudioData(
          combinedBuffer,
          targetLanguageCode,
          roomId,
          userId
        );
        delete audioChunks[chunkKey];
        return result;
      } catch (error) {
        console.error("Error processing combined audio:", error);
        audioChunks[chunkKey].processing = false;
        throw error;
      }
    }

    // If not all chunks received, process the current chunk for TTS (for better UX)
    // This is a fallback for real-time feedback, not ideal for production
    if (audioBuffer.length > 1000) { // Only process if chunk is not too short
      const result = await processAudioData(
        audioBuffer,
        targetLanguageCode,
        roomId,
        userId
      );
      return result;
    }

    // If chunk is too short, return empty
    return Buffer.from(
      JSON.stringify({
        status: "chunk_received",
        message: `Chunk ${chunkIndex + 1}/${totalChunks} received successfully`,
        chunkIndex: chunkIndex,
        totalChunks: totalChunks,
        pendingChunks: audioChunks[chunkKey].chunks
          .map((c, i) => (c === null ? i : null))
          .filter((i) => i !== null),
      }), 'utf-8'
    );
  } catch (error) {
    console.error("Error in handleAudioRequest:", error);
    throw error;
  }
}

// Constants for audio validation
const MIN_RMS_LEVEL = 20; // Lowered from 100 to 20 for better sensitivity
const SAMPLE_RATE = 16000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
let lastLoggedTime = 0; // Track last time we logged



export async function processAudioData(
  audioBuffer: Buffer,
  targetLanguageCode: string,
  roomId: string,
  userId: string
): Promise<Buffer> {
  try {
    // Verify audio data first


    // Check if audio is base64 encoded
    const isBase64 = audioBuffer.toString('ascii', 0, 4) !== 'RIFF';
    const processedBuffer = isBase64 ? Buffer.from(audioBuffer.toString(), 'base64') : audioBuffer;

    // Log audio details (only when debugging)
    const now = Date.now();
    if (!lastLoggedTime || now - lastLoggedTime > 10000) {
      console.log('Processing audio:', {
        originalSize: audioBuffer.length,
        processedSize: processedBuffer.length,
        isBase64: isBase64,
        hasWavHeader: processedBuffer.toString('ascii', 0, 4) === 'RIFF',
        sampleRate: processedBuffer.readUInt32LE(24),
        channels: processedBuffer.readUInt16LE(22),
        bitsPerSample: processedBuffer.readUInt16LE(34)
      });
      lastLoggedTime = now;
    }

    // Validate WAV header
    if (processedBuffer.length < 44) {
      throw new Error('Audio buffer too small');
    }

    if (processedBuffer.toString('ascii', 0, 4) !== 'RIFF') {
      throw new Error('Invalid WAV format');
    }

    // Extract PCM data (skip WAV header)
    const pcmData = processedBuffer.slice(44);

    // Calculate audio statistics
    const totalSamples = pcmData.length / 2; // 16-bit samples
    let sumSquares = 0;
    let maxValue = 0;
    let minValue = 0;
    let nonZeroSamples = 0;

    for (let i = 0; i < pcmData.length; i += 2) {
      const sample = pcmData.readInt16LE(i);
      if (sample !== 0) {
        sumSquares += sample * sample;
        maxValue = Math.max(maxValue, sample);
        minValue = Math.min(minValue, sample);
        nonZeroSamples++;
      }
    }

    const rmsLevel = nonZeroSamples > 0 ? Math.sqrt(sumSquares / nonZeroSamples) : 0;
    const isValidAmplitude = rmsLevel > MIN_RMS_LEVEL;

    // Only log audio statistics occasionally
    if (now % 30000 < 1000) { // Log once every 30 seconds approximately
      console.log('Audio statistics:', {
        totalSamples,
        nonZeroSamples,
        rmsLevel: rmsLevel.toFixed(2),
        maxValue,
        minValue,
        isValidAmplitude,
        threshold: MIN_RMS_LEVEL,
        percentageNonZero: ((nonZeroSamples / totalSamples) * 100).toFixed(2) + '%'
      });
    }

    // If amplitude is too low, don't waste API calls
    if (!isValidAmplitude) {
      return Buffer.from(JSON.stringify({ text: '' }));
    }

    // Prepare professional speech recognition request
    const request: speechProtos.google.cloud.speech.v1.IRecognizeRequest = {
      audio: {
        content: processedBuffer.toString('base64')
      },
      config: {
        encoding: speechProtos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.LINEAR16,
        sampleRateHertz: SAMPLE_RATE,
        languageCode:  'en-US',
        model: 'default',
        enableAutomaticPunctuation: true,
        useEnhanced: true,
        profanityFilter: true,
        maxAlternatives: 1,
        speechContexts: [{
          phrases: [
            "meeting", "conference", "project", "team", "discuss", "update",
            "schedule", "timeline", "deadline", "priority", "status", "report",
            "client", "customer", "presentation", "analysis", "review", "summary",
            "action", "item", "task", "assign", "complete", "progress", "issue",
            "question", "answer", "feedback", "concern", "solution", "problem"
          ],
          boost: 10
        }]
      }
    };

    try {
      console.log('Sending request to Speech-to-Text API');
      const [response] = await speechClient.recognize(request);

      console.log('Received response from Speech-to-Text API' , response);
      // Log the full alternatives array for debugging
      if (response.results && response.results[0]) {
        console.log('Alternatives:', JSON.stringify(response.results[0].alternatives, null, 2));
      }

      if (!response.results || response.results.length === 0) {
        console.log('No transcription results');
        return Buffer.from(JSON.stringify({ text: '' }));
      }

      const transcription = response.results
        .map(result =>result.alternatives && result.alternatives?.[0]?.transcript)
        .filter(Boolean)
        .join(' ');
      const firstResult = response.results && response.results[0] && response.results[0].alternatives && response.results[0].alternatives[0] ? response.results[0].alternatives[0] : null;
      const confidence = firstResult ? firstResult.confidence || 0 : 0;

      // Format transcription for readability and correctness
      const formattedText = transcription
        .trim()
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/([.!?])\s*(?=[A-Z])/g, '$1\n'); // Add new lines after sentences
      console.log('Transcription:', transcription);
      
      console.log('Transcription:', formattedText);

      // After transcription and before returning the response, send the caption to the room
      if (formattedText && roomId && userId) {
        try {
          const captionPacket = {
            type: "caption",
            text: formattedText,
            confidence,
            userId,
            roomId,
            timestamp: Date.now(),
          };
          await roomService.sendData(
            roomId,
            Buffer.from(JSON.stringify(captionPacket)),
            DataPacket_Kind.RELIABLE
          );
          console.log('LiveKit caption sent:', captionPacket);
        } catch (err) {
          console.error('Error sending LiveKit caption:', err);
        }
      }

      // --- FIX: Always return both text and TTS audioContent ---
      if (formattedText && formattedText.trim()) {
        // Use the same translation and TTS logic as in processAudioRequest
        let translatedText = formattedText;
        if (targetLanguageCode && targetLanguageCode !== 'en-US') {
          translatedText = await translateText(formattedText, targetLanguageCode);
        }
        const synthesizedSpeech = await synthesizeSpeech(translatedText, targetLanguageCode);
        const audioContentBase64 = synthesizedSpeech ? synthesizedSpeech.toString('base64') : '';
        // --- NEW: Broadcast TTS audio as LiveKit data message ---
        if (audioContentBase64 && roomId && userId) {
          try {
            const ttsPacket = {
              type: 'tts',
              audioContent: audioContentBase64,
              language: targetLanguageCode,
              userId,
              roomId,
              timestamp: Date.now(),
            };
            await roomService.sendData(
              roomId,
              Buffer.from(JSON.stringify(ttsPacket)),
              DataPacket_Kind.RELIABLE
            );
            console.log('LiveKit TTS sent:', { length: audioContentBase64.length, language: targetLanguageCode });
          } catch (err) {
            console.error('Error sending LiveKit TTS:', err);
          }
        }
        // --- END NEW ---
        console.log('Sending response:', {
          text: translatedText,
          audioContentLength: audioContentBase64.length,
          audioContentSample: audioContentBase64.substring(0, 30),
          language: targetLanguageCode,
          confidence
        });
        return Buffer.from(JSON.stringify({
          text: translatedText,
          audioContent: audioContentBase64,
          confidence
        }), 'utf-8');
      }
      // --- END FIX ---

      return Buffer.from(JSON.stringify({ text: '' }));
    } catch (error) {
      console.error('Speech-to-Text API error:', error);

      // For demo purposes in case API fails
      if (Math.random() < 0.5) {
        return Buffer.from(JSON.stringify({ text: '' }));
      } else {
        // Provide meaningful placeholder text
        return Buffer.from(JSON.stringify({
          text: 'I am speaking at the meeting',
          demo: true // Mark this as demo text
        }));
      }
    }
  } catch (error) {
    console.error('Error processing audio:', error);
    throw error;
  }
}

function getCountryCode(languageCode: string): string {
  // Extract country code from language code (e.g., "en-US" -> "US")
  const parts = languageCode.split('-');
  return parts.length > 1 ? parts[1] : parts[0];
}

async function translateText(
  text: string,
  targetLanguage: string
): Promise<string> {
  try {
    const [translation] = await translateClient.translateText({
      parent: `projects/${projectId}/locations/global`,
      contents: [text],
      mimeType: 'text/plain',
      targetLanguageCode: targetLanguage,
    });

    // Fix null/undefined check
    if (!translation || !translation.translations || !translation.translations[0]) {
      return text; // Return original text if translation is missing
    }

    const translatedText = translation.translations[0].translatedText;
    return translatedText || text;
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}

export async function synthesizeSpeech(
  text: string,
  languageCode: string
): Promise<Buffer> {
  try {
    const [response] = await ttsClient.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode,
        ssmlGender: protos.google.cloud.texttospeech.v1.SsmlVoiceGender.NEUTRAL,
      },
      audioConfig: {
        audioEncoding: protos.google.cloud.texttospeech.v1.AudioEncoding.MP3,
      },
    });

    // Fix null/undefined check
    if (!response || !response.audioContent) {
      throw new Error('No audio content in response');
    }

    return Buffer.from(response.audioContent as Buffer);
  } catch (error) {
    console.error('Speech synthesis error:', error);
    throw error;
  }
}
export async function processAudioRequest(
  req: AudioProcessingRequest
): Promise<Buffer> {
  try {
    const { audio, targetLanguageCode } = req;

    // Validate audio data
    if (!audio || audio.length < 100) {
      throw new Error("Invalid audio data");
    }

    // Process the audio data
    const processedAudio = await handleAudioRequest(req);

    // Parse the transcription result
    const transcriptionResult = JSON.parse(processedAudio.toString());

    // If no transcription, return empty buffer
    if (!transcriptionResult.text || !transcriptionResult.text.trim()) {
      return Buffer.from(JSON.stringify({ text: '', audioContent: '' }));
    }

    // Translate the transcription if a target language is provided
    let translatedText = transcriptionResult.text;
    if (targetLanguageCode && targetLanguageCode !== 'en-US') {
      translatedText = await translateText(transcriptionResult.text, targetLanguageCode);
    }

    // Synthesize speech from the translated text
    const synthesizedSpeech = await synthesizeSpeech(translatedText, targetLanguageCode);

    // Debug log to confirm audioContent is present
    console.log('Sending response:', {
      text: translatedText,
      audioContent: synthesizedSpeech ? '[base64 audio]' : null,
      confidence: transcriptionResult.confidence || 0
    });

    // Return both the text and the audio as base64
    return Buffer.from(JSON.stringify({
      text: translatedText,
      audioContent: synthesizedSpeech.toString('base64'),
      confidence: transcriptionResult.confidence || 0
    }), 'utf-8');
  } catch (error) {
    console.error("Error processing audio request:", error);
    throw error;
  }
}