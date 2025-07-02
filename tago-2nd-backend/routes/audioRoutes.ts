// import { Router } from "express";
// import { processAudio } from "../controllers/old_audioController";

// const router = Router();

// router.post("/process", processAudio);

// export default router;
import { Router, Request, Response } from "express";
import { processAudioData } from "../controllers/audioController";
import path from 'path';
import fs from 'fs';
import { synthesizeSpeech } from '../controllers/audioController';

const router = Router();

interface AudioRequest extends Request {
  body: {
    audio: string; // Changed from Buffer to string since we receive base64
    userId: string;
    roomId: string;
    targetLanguageCode: string;
    chunkIndex: number;
    totalChunks: number;
  }
}

router.post('/process', async (req: AudioRequest, res: Response) => {
  try {
    console.log("Received audio request:", {
      userId: req.body.userId,
      roomId: req.body.roomId,
      chunkIndex: req.body.chunkIndex,
      totalChunks: req.body.totalChunks,
      audioLength: req.body.audio?.length
    });

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(req.body.audio, 'base64');
    
    // Process the audio
    const result = await processAudioData(audioBuffer, req.body.targetLanguageCode, req.body.roomId, req.body.userId);
    
    // Parse the buffer to JSON before sending the response
    let responseData;
    try {
      responseData = JSON.parse(result.toString());
      console.log("Sending response:", responseData);
    } catch (e) {
      console.error("Error parsing result buffer:", e);
      responseData = { text: "All is not well" }; // Fallback
    }
    
    // Send response
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Audio processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process audio',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add route to play audio file
router.get('/play/:filename', (req: Request<{filename: string}>, res: Response) => {
  try {
    const filePath = path.join(process.cwd(), 'temp', req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Audio file not found');
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/wav',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'audio/wav',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    console.error('Error playing audio:', error);
    res.status(500).send('Error playing audio file');
  }
});

// TTS endpoint: POST /tts { text, language } => { audioContent }
router.post('/tts', async (req: Request, res: Response) => {
  try {
    const { text, language } = req.body;
    if (!text || !language) {
      return res.status(400).json({ error: 'Missing text or language' });
    }
    const audioBuffer = await synthesizeSpeech(text, language);
    const audioContent = audioBuffer.toString('base64');
    res.json({ audioContent });
  } catch (error) {
    console.error('TTS endpoint error:', error);
    res.status(500).json({ error: 'Failed to synthesize speech' });
  }
});

export default router;