import { AgentContext,Tool } from '../../base/types';

/**
 * Google Cloud Vision OCR Tool
 * Extract text from images
 */
export const googleOCRTool: Tool = {
  name: 'google_ocr',
  description: 'Extract text from images using Google Cloud Vision OCR',
  parameters: {
    type: 'object',
    properties: {
      image_url: { type: 'string', description: 'URL or base64 encoded image' },
      language_hints: { type: 'array', items: { type: 'string' }, description: 'Language hints (e.g., ["en", "rw"])' }
    },
    required: ['image_url']
  },
  capabilities: ['vision', 'ocr'],
  execute: async (params, context) => {
    // Using Google Cloud Vision API
    const vision = require('@google-cloud/vision');
    const client = new vision.ImageAnnotatorClient();

    const [result] = await client.textDetection({
      image: { source: { imageUri: params.image_url } }
    });

    const detections = result.textAnnotations;
    const fullText = detections?.[0]?.description || '';

    return {
      full_text: fullText,
      blocks: detections?.slice(1).map((text: any) => ({
        text: text.description,
        confidence: text.confidence,
        bounds: text.boundingPoly
      }))
    };
  }
};

/**
 * Google Translate Tool
 * Translate text between languages
 */
export const googleTranslateTool: Tool = {
  name: 'google_translate',
  description: 'Translate text between languages (supports Kinyarwanda, English, French, Swahili)',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to translate' },
      target_language: { type: 'string', description: 'Target language code (en, fr, rw, sw)' },
      source_language: { type: 'string', description: 'Source language code (auto-detect if not specified)' }
    },
    required: ['text', 'target_language']
  },
  capabilities: ['translation', 'multilingual'],
  execute: async (params, context) => {
    const { Translate } = require('@google-cloud/translate').v2;
    const translate = new Translate();

    const [translation] = await translate.translate(params.text, {
      from: params.source_language,
      to: params.target_language
    });

    const [detection] = await translate.detect(params.text);

    return {
      translated_text: translation,
      detected_language: detection.language,
      confidence: detection.confidence
    };
  }
};

/**
 * Google Speech-to-Text Tool
 * Convert audio to text
 */
export const googleSpeechToTextTool: Tool = {
  name: 'google_speech_to_text',
  description: 'Convert audio to text using Google Speech-to-Text',
  parameters: {
    type: 'object',
    properties: {
      audio_url: { type: 'string', description: 'URL to audio file or base64 encoded audio' },
      language_code: { type: 'string', description: 'Language code (en-US, fr-FR, rw-RW)' },
      encoding: { type: 'string', description: 'Audio encoding (LINEAR16, FLAC, MP3)' }
    },
    required: ['audio_url']
  },
  capabilities: ['voice', 'speech-to-text'],
  execute: async (params, context) => {
    const speech = require('@google-cloud/speech');
    const client = new speech.SpeechClient();

    const audio = {
      uri: params.audio_url
    };

    const config = {
      encoding: params.encoding || 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: params.language_code || 'en-US',
      alternativeLanguageCodes: ['fr-FR', 'rw-RW', 'sw-KE']
    };

    const request = {
      audio: audio,
      config: config,
    };

    const [response] = await client.recognize(request);
    const transcription = response.results
      ?.map((result: any) => result.alternatives[0].transcript)
      .join('\n');

    return {
      transcription,
      confidence: response.results?.[0]?.alternatives[0]?.confidence,
      language: response.results?.[0]?.languageCode
    };
  }
};

/**
 * Google Text-to-Speech Tool
 * Convert text to audio
 */
export const googleTextToSpeechTool: Tool = {
  name: 'google_text_to_speech',
  description: 'Convert text to speech audio',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to convert to speech' },
      language_code: { type: 'string', description: 'Language code (en-US, fr-FR, rw-RW)' },
      voice_name: { type: 'string', description: 'Voice name (optional)' }
    },
    required: ['text']
  },
  capabilities: ['voice', 'text-to-speech'],
  execute: async (params, context) => {
    const textToSpeech = require('@google-cloud/text-to-speech');
    const client = new textToSpeech.TextToSpeechClient();

    const request = {
      input: { text: params.text },
      voice: {
        languageCode: params.language_code || 'en-US',
        name: params.voice_name,
        ssmlGender: 'NEUTRAL'
      },
      audioConfig: { audioEncoding: 'MP3' },
    };

    const [response] = await client.synthesizeSpeech(request);

    return {
      audio_content: response.audioContent?.toString('base64'),
      audio_format: 'mp3'
    };
  }
};
