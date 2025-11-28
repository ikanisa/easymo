// Google Search Grounding
export {
  searchWithGrounding,
  generateFactualResponse,
  searchRecentInfo,
  compareSourcesOnTopic,
  summarizeWithSources,
  formatGroundedResponseAsMarkdown,
  type GroundingMetadata,
  type GroundedResponse,
} from "./search-grounding";

// Gemini Live API (Voice)
export {
  createLiveSession,
  processAudioInput,
  textToSpeech,
  speechToText,
  streamAudioConversation,
  closeLiveSession,
  createLiveSessionWithInstructions,
  audioFileToBase64,
  playAudioFromBase64,
  type LiveSession,
  type AudioConfig,
  type VoiceConfig,
} from "./gemini-live";

export const GOOGLE_AI_VERSION = "1.0.0";
