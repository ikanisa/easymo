export interface WhatsappPresetOptions {
  /** Target maximum video bitrate in kilobits per second */
  maxVideoKbps?: number;
  /** Target audio bitrate in kilobits per second */
  audioKbps?: number;
  /** Optional max width (default 720) */
  maxWidth?: number;
}

export function buildWhatsappPreset(
  inputPath: string,
  outputPath: string,
  options: WhatsappPresetOptions = {},
): string[] {
  const videoBitrate = Math.max(400, options.maxVideoKbps ?? 1200);
  const audioBitrate = Math.max(48, options.audioKbps ?? 96);
  const maxWidth = Math.max(320, options.maxWidth ?? 720);
  const scaleFilter = `scale='min(${maxWidth},iw)':-2`;

  return [
    "-y",
    "-i",
    inputPath,
    "-vf",
    `${scaleFilter},format=yuv420p`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-profile:v",
    "high",
    "-level",
    "4.1",
    "-pix_fmt",
    "yuv420p",
    "-b:v",
    `${videoBitrate}k`,
    "-maxrate",
    `${videoBitrate}k`,
    "-bufsize",
    `${videoBitrate * 2}k`,
    "-c:a",
    "aac",
    "-b:a",
    `${audioBitrate}k`,
    "-ac",
    "2",
    "-ar",
    "48000",
    "-movflags",
    "+faststart",
    outputPath,
  ];
}
