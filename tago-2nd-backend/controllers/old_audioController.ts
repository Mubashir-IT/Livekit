import { Request, Response } from "express";
// @ts-ignore
import { SpeechClient } from "@google-cloud/speech";
// @ts-ignore
import { TranslationServiceClient } from "@google-cloud/translate";
import { RoomServiceClient, DataPacket_Kind } from "livekit-server-sdk";
// @ts-ignore
import { TextToSpeechClient } from "@google-cloud/text-to-speech";

const speechClient = new SpeechClient();
const ttsClient = new TextToSpeechClient();
const translateClient = new TranslationServiceClient();
const livekitHost = "wss://test-tago-bits-hi4jwi9r.livekit.cloud";
const roomService = new RoomServiceClient(
  livekitHost,
  process.env.LIVEKIT_API_KEY || "",
  process.env.LIVEKIT_API_SECRET || ""
);

export const processAudio = async (req: Request, res: Response) => {
  try {
    const { audio, userId, roomId, targetLanguageCode } = req.body;

    if (!audio || !userId || !roomId) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters",
      });
    }

    // Convert base64 to buffer with error handling
    let audioBuffer;
    try {
      audioBuffer = Buffer.from(audio, "base64");
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid audio data",
      });
    }

    // Speech to Text with proper error handling
    try {
      const [response] = await speechClient.recognize({
        config: {
          encoding: "LINEAR16",
          sampleRateHertz: 16000,
          languageCode: "ur",
          audioChannelCount: 1,
          enableAutomaticPunctuation: true,
          model: "default",
          useEnhanced: true, // Use enhanced model
        },
        audio: { content: audioBuffer.toString("base64") },
      });

      if (!response || !response.results) {
        throw new Error("No speech recognition results");
      }

      const transcription = response.results
        .map((result) => result.alternatives?.[0]?.transcript || "")
        .join(" ");

      // Only proceed if we have transcription
      if (!transcription.trim()) {
        return res.status(200).json({
          success: true,
          message: "No speech detected",
        });
      }

      // Translation
      const [translation] = await translateClient.translateText({
        contents: [transcription],
        targetLanguageCode: targetLanguageCode || "en",
        parent: `projects/tagobots-ai-457504/locations/global`,
      });

      console.log("Translation response:", translation);
      const translatedText =
        translation.translations?.[0]?.translatedText || "";

      // Text-to-Speech
      const [ttsResponse] = await ttsClient.synthesizeSpeech({
        input: { text: translatedText },
        voice: {
          languageCode: targetLanguageCode || "en-US",
          ssmlGender: "NEUTRAL",
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 1.0,
          pitch: 0,
          volumeGainDb: 0,
        },
      });

      // Send translated audio to other participants
      if (ttsResponse.audioContent) {
        const users = await roomService.listParticipants(roomId);

        // Prepare the data packet
        const audioPacket = {
          type: "translated_audio",
          audio:
            typeof ttsResponse.audioContent === "string"
              ? Buffer.from(ttsResponse.audioContent, "base64").toString(
                  "base64"
                )
              : Buffer.from(ttsResponse.audioContent).toString("base64"),
          transcription,
          translatedText,
          sourceLanguage: "ur",
          targetLanguage: targetLanguageCode || "en",
        };

        // Send to all participants except the speaker
        for (const user of users) {
          if (user.identity !== userId) {
            await roomService.sendData(
              roomId,
              Buffer.from(JSON.stringify(audioPacket)),
              DataPacket_Kind.RELIABLE,
              { destinationSids: [user.sid] }
            );
          }
        }
      }

      res.status(200).json({
        success: true,
        transcription,
        translatedText,
        sourceLanguage: "ur",
        targetLanguage: targetLanguageCode || "en",
      });
    } catch (error: any) {
      console.error("Speech-to-Text error:", error);

      // Handle specific Google API errors
      if (error.code === 7) {
        return res.status(503).json({
          success: false,
          message: "Speech-to-Text service unavailable",
          details: error.details || "Please try again later",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Error processing speech",
        details: error.message || "Unknown error occurred",
      });
    }
  } catch (error: any) {
    console.error("Error processing audio:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      details: error.details || "Unknown error occurred",
    });
  }
};
