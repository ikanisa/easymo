import { promises as fs } from "node:fs";
import { join } from "node:path";

export interface TtsOptions {
  voice?: string;
  speakingRate?: number;
}

export class TtsSynthesizer {
  constructor(private readonly outputDirectory: string) {}

  async synthesise(
    baseName: string,
    language: string,
    segments: string[],
    options: TtsOptions = {},
  ): Promise<string> {
    const target = join(
      this.outputDirectory,
      `${baseName}.${language}.tts.txt`,
    );
    const metadata = {
      language,
      voice: options.voice ?? "narrator",
      speakingRate: options.speakingRate ?? 1,
      transcript: segments,
      generatedAt: new Date().toISOString(),
    };
    await fs.mkdir(this.outputDirectory, { recursive: true });
    await fs.writeFile(target, JSON.stringify(metadata, null, 2), "utf-8");
    return target;
  }
}
