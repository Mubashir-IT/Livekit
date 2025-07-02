import { Request, Response } from "express";
import { TranslationServiceClient } from "@google-cloud/translate";
import path from "path";
import fs from "fs";

// Initialize translation client
let translateClient: TranslationServiceClient;
let googleTranslationEnabled = false;

// Simple in-memory cache for translations
const translationCache: {[key: string]: {text: string, timestamp: number}} = {};
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Helper to get/set cache
const getCachedTranslation = (text: string, sourceLang: string, targetLang: string): string | null => {
  const key = `${sourceLang}:${targetLang}:${text}`;
  const cached = translationCache[key];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Using cached translation');
    return cached.text;
  }
  return null;
};

const setCachedTranslation = (text: string, sourceLang: string, targetLang: string, translatedText: string): void => {
  const key = `${sourceLang}:${targetLang}:${text}`;
  translationCache[key] = {
    text: translatedText,
    timestamp: Date.now()
  };
};

// Basic cleanup of cache - remove expired entries periodically
setInterval(() => {
  const now = Date.now();
  Object.keys(translationCache).forEach(key => {
    if (now - translationCache[key].timestamp > CACHE_TTL) {
      delete translationCache[key];
    }
  });
}, 60 * 60 * 1000); // Run every hour

// Initialize Google Translation API
let projectId: string = '';
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
    console.error(`
    ============================================================
    ERROR: Google Cloud credentials not found!
    
    To use Google Translation API:
    1. Create a Google Cloud project: https://console.cloud.google.com/
    2. Enable the Cloud Translation API
    3. Create a service account with Translation API access
    4. Download the JSON key file
    5. Place it in the project root as "google-cloud.json"
    ============================================================
    `);
    googleTranslationEnabled = false;
  } else {
    console.log("Found credentials at:", credentialsPath);
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
    projectId = credentials.project_id;
    
    // Initialize the translation client
    translateClient = new TranslationServiceClient({
      keyFilename: credentialsPath
    });
    googleTranslationEnabled = true;
    
    console.log("Successfully loaded credentials for project:", projectId);
    
    // Test the connection to confirm it works
    translateClient
      .translateText({
        parent: `projects/${projectId}/locations/global`,
        contents: ["test"],
        targetLanguageCode: "es",
      })
      .then(() => {
        console.log("✅ Google Translation API is working properly");
        googleTranslationEnabled = true;
      })
      .catch((err) => {
        console.error(`
        ============================================================
        ERROR: Google Translation API test failed: ${err.message}
        
        Common issues:
        1. The Translation API may not be enabled for your project
        2. The service account may not have Translation API access
        3. The project may not have billing enabled
        
        To fix:
        1. Go to https://console.cloud.google.com/apis/library/translate.googleapis.com
        2. Make sure the API is enabled for your project
        3. Verify your service account has the "Cloud Translation API User" role
        4. Check that billing is enabled for your project
        ============================================================
        `);
        googleTranslationEnabled = false;
      });
  }
} catch (error: any) {
  console.error("Error loading Google Cloud credentials:", error.message);
  googleTranslationEnabled = false;
}

export const translateText = async (req: Request, res: Response) => {
  try {
    const { text, sourceLang, targetLang } = req.body;
    console.log('Incoming /translate request:', req.body); // <-- Add this line

    // Validate request
    if (!text || !targetLang) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters",
      });
    }

    // Normalize sourceLang: if empty, undefined, or falsy, use 'auto'
    const normalizedSourceLang = sourceLang && sourceLang.trim() ? sourceLang : 'auto';

    // Skip translation if source and target languages are the same
    if (normalizedSourceLang !== 'auto' && normalizedSourceLang === targetLang) {
      return res.status(200).json({
        success: true,
        translatedText: text,
        sourceLanguage: normalizedSourceLang,
        targetLanguage: targetLang,
      });
    }

    // Check cache first
    const cachedResult = getCachedTranslation(text, normalizedSourceLang, targetLang);
    if (cachedResult) {
      return res.status(200).json({
        success: true,
        translatedText: cachedResult,
        sourceLanguage: normalizedSourceLang,
        targetLanguage: targetLang,
        cached: true
      });
    }

    // If Google Translation isn't available
    if (!googleTranslationEnabled) {
      return res.status(503).json({
        success: false,
        message: "Google Translation API is not available",
        details: "Please enable the Translation API in your Google Cloud project and configure proper credentials.",
      });
    }

    // Perform translation with Google
    try {
      // Build request for Google Translate API v3
      const request: any = {
        parent: `projects/${projectId}/locations/global`,
        contents: [text],
        mimeType: 'text/plain',
        targetLanguageCode: targetLang,
      };
      if (normalizedSourceLang !== 'auto') {
        request.sourceLanguageCode = normalizedSourceLang;
      }
      console.log(`[Google Translate] Sending request:`, request);
      const [translation] = await translateClient.translateText(request);

      // Check for valid translation response
      if (!translation || !translation.translations || !translation.translations[0]) {
        throw new Error("Translation failed: No translation returned");
      }

      const translatedText = translation.translations[0].translatedText || text;
      const detectedSourceLanguage = translation.translations[0].detectedLanguageCode || normalizedSourceLang;

      // Cache the result
      setCachedTranslation(text, normalizedSourceLang || detectedSourceLanguage, targetLang, translatedText);

      // Return the translated text
      return res.status(200).json({
        success: true,
        translatedText,
        sourceLanguage: detectedSourceLanguage,
        targetLanguage: targetLang,
      });
    } catch (error: any) {
      console.error("Google Translation API error:", error.message);
      
      // If Google translation fails
      if (error.code === 7) { // PERMISSION_DENIED
        googleTranslationEnabled = false;
        console.error(`
        ============================================================
        ERROR: Translation API PERMISSION_DENIED

        This typically means one of three things:
        1. The API is not enabled for your project
        2. The service account doesn't have permission to use the API
        3. Billing is not enabled for your project

        Please check your Google Cloud console and ensure:
        - Cloud Translation API is enabled
        - Service account has the "Cloud Translation API User" role
        - Billing is properly set up
        ============================================================
        `);
      }
      
      return res.status(500).json({
        success: false,
        message: "Google Translation API error",
        details: error.message,
        code: error.code
      });
    }
  } catch (error: any) {
    console.error("Translation controller error:", error);
    
    return res.status(500).json({
      success: false,
      message: "Translation server error",
      details: error.message
    });
  }
};