// Google Search Grounding
export {
  compareSourcesOnTopic,
  formatGroundedResponseAsMarkdown,
  generateFactualResponse,
  type GroundedResponse,
  type GroundingMetadata,
  searchRecentInfo,
  searchWithGrounding,
  summarizeWithSources,
} from "./search-grounding";

// Gemini Live API (Voice)
export {
  type AudioConfig,
  audioFileToBase64,
  closeLiveSession,
  createLiveSession,
  createLiveSessionWithInstructions,
  type LiveSession,
  playAudioFromBase64,
  processAudioInput,
  speechToText,
  streamAudioConversation,
  textToSpeech,
  type VoiceConfig,
} from "./gemini-live";

export const GOOGLE_AI_VERSION = "1.0.0";
