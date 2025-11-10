import { basename } from "node:path";

export interface WhisperOptions {
  prompt?: string;
  temperature?: number;
}

export interface CaptionSegment {
  start: number;
  end: number;
  text: string;
}

export class WhisperService {
  constructor(private readonly binary = process.env.WHISPER_BINARY ?? "whisper") {}

  async transcribe(
    inputPath: string,
    language: string,
    options: WhisperOptions = {},
  ): Promise<CaptionSegment[]> {
    // In production this method would invoke the Whisper CLI or OpenAI API.
    // For the repository we provide a deterministic placeholder implementation
    // that still produces time-coded segments so downstream consumers can be
    // validated in tests.
    const safeName = basename(inputPath);
    const lines = [`${language.toUpperCase()} track for ${safeName}`];
    if (options.prompt) {
      lines.push(`prompt: ${options.prompt}`);
    }
    return [
      {
        start: 0,
        end: 4,
        text: lines.join(" \u2022 "),
      },
      {
        start: 4,
        end: 8,
        text: `Rendered with ${this.binary}`,
      },
    ];
  }
}
