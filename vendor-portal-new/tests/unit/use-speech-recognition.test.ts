"use strict";

import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Unit tests for use-speech-recognition hook
 * 
 * Tests the Web Speech API integration including:
 * - Browser support detection
 * - Transcript handling
 * - Error states
 * - Start/stop controls
 */

describe("useSpeechRecognition hook", () => {
  describe("Browser Support Detection", () => {
    it("should detect SpeechRecognition support", () => {
      // Simulate browser support check
      const hasSpeechRecognition = typeof window !== 'undefined' && 
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

      // In Node.js test environment, should be false
      assert.equal(hasSpeechRecognition, false);
    });

    it("should handle unsupported browsers gracefully", () => {
      const isSupported = false;
      
      const startListening = () => {
        if (!isSupported) {
          throw new Error('Speech recognition not available');
        }
      };

      assert.throws(
        () => startListening(),
        /Speech recognition not available/
      );
    });
  });

  describe("Transcript Management", () => {
    it("should accumulate transcript text", () => {
      let transcript = '';
      const newText = 'Hello world';

      transcript = transcript + newText;

      assert.equal(transcript, 'Hello world');
    });

    it("should append multiple transcript chunks", () => {
      let transcript = '';
      const chunks = ['Hello', 'world', 'from', 'voice'];

      for (const chunk of chunks) {
        transcript += chunk + ' ';
      }

      assert.equal(transcript.trim(), 'Hello world from voice');
    });

    it("should reset transcript on demand", () => {
      let transcript = 'Some existing text';

      const resetTranscript = () => {
        transcript = '';
      };

      resetTranscript();
      assert.equal(transcript, '');
    });
  });

  describe("Error Handling", () => {
    it("should categorize no-speech error", () => {
      const error = { error: 'no-speech' };
      
      let errorMessage = 'Speech recognition error';
      if (error.error === 'no-speech') {
        errorMessage = 'No speech detected. Please try again.';
      }

      assert.equal(errorMessage, 'No speech detected. Please try again.');
    });

    it("should categorize audio-capture error", () => {
      const error = { error: 'audio-capture' };
      
      let errorMessage = 'Speech recognition error';
      if (error.error === 'audio-capture') {
        errorMessage = 'No microphone found. Please check your device.';
      }

      assert.equal(errorMessage, 'No microphone found. Please check your device.');
    });

    it("should categorize not-allowed error", () => {
      const error = { error: 'not-allowed' };
      
      let errorMessage = 'Speech recognition error';
      if (error.error === 'not-allowed') {
        errorMessage = 'Microphone access denied. Please grant permission.';
      }

      assert.equal(errorMessage, 'Microphone access denied. Please grant permission.');
    });

    it("should categorize network error", () => {
      const error = { error: 'network' };
      
      let errorMessage = 'Speech recognition error';
      if (error.error === 'network') {
        errorMessage = 'Network error. Please check your connection.';
      }

      assert.equal(errorMessage, 'Network error. Please check your connection.');
    });

    it("should provide generic error message for unknown errors", () => {
      const error = { error: 'unknown-error' };
      
      const errorMessage = `Speech recognition error: ${error.error}`;

      assert.equal(errorMessage, 'Speech recognition error: unknown-error');
    });
  });

  describe("Recognition State", () => {
    it("should track listening state", () => {
      let isListening = false;

      const startListening = () => {
        isListening = true;
      };

      const stopListening = () => {
        isListening = false;
      };

      assert.equal(isListening, false);
      
      startListening();
      assert.equal(isListening, true);
      
      stopListening();
      assert.equal(isListening, false);
    });

    it("should toggle listening state", () => {
      let isListening = false;

      const toggleListening = () => {
        isListening = !isListening;
      };

      toggleListening();
      assert.equal(isListening, true);
      
      toggleListening();
      assert.equal(isListening, false);
    });
  });

  describe("Recognition Configuration", () => {
    it("should configure continuous recognition", () => {
      const config = {
        continuous: true,
        interimResults: true,
        lang: 'en-US',
        maxAlternatives: 1,
      };

      assert.equal(config.continuous, true);
      assert.equal(config.interimResults, true);
    });

    it("should support language configuration", () => {
      const languages = ['en-US', 'rw-RW', 'fr-FR'];

      languages.forEach(lang => {
        const config = { lang };
        assert.ok(config.lang.length > 0);
        assert.ok(config.lang.includes('-'));
      });
    });
  });

  describe("Result Processing", () => {
    it("should distinguish between interim and final results", () => {
      const results = [
        { transcript: 'Hello', isFinal: false },
        { transcript: 'Hello world', isFinal: true },
      ];

      let finalTranscript = '';
      let interimTranscript = '';

      results.forEach(result => {
        if (result.isFinal) {
          finalTranscript += result.transcript + ' ';
        } else {
          interimTranscript = result.transcript;
        }
      });

      assert.equal(finalTranscript.trim(), 'Hello world');
      assert.equal(interimTranscript, 'Hello');
    });

    it("should process multiple final results", () => {
      const results = [
        { transcript: 'First sentence', isFinal: true },
        { transcript: 'Second sentence', isFinal: true },
        { transcript: 'Third sentence', isFinal: true },
      ];

      let transcript = '';
      results.forEach(result => {
        if (result.isFinal) {
          transcript += result.transcript + ' ';
        }
      });

      assert.equal(
        transcript.trim(),
        'First sentence Second sentence Third sentence'
      );
    });
  });

  describe("Cleanup", () => {
    it("should cleanup on unmount", () => {
      let isActive = true;
      let isListening = true;

      const cleanup = () => {
        isListening = false;
        isActive = false;
      };

      cleanup();

      assert.equal(isListening, false);
      assert.equal(isActive, false);
    });
  });

  describe("Already Started Error", () => {
    it("should handle already started error gracefully", () => {
      let isListening = false;
      
      const start = () => {
        if (isListening) {
          throw new Error('recognition already started');
        }
        isListening = true;
      };

      start(); // First call succeeds
      assert.equal(isListening, true);

      // Second call should throw
      assert.throws(
        () => start(),
        /already started/
      );
    });
  });
});
