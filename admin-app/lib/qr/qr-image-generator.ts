/**
 * QR Code Image Generation Utilities
 * Generates QR code images as Data URLs or blobs for download
 */

import QRCode from 'qrcode';

export interface QrImageOptions {
  width?: number;
  margin?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  color?: {
    dark?: string;
    light?: string;
  };
}

const DEFAULT_OPTIONS: Required<QrImageOptions> = {
  width: 512,
  margin: 2,
  errorCorrectionLevel: 'M',
  color: {
    dark: '#000000',
    light: '#FFFFFF',
  },
};

/**
 * Generate QR code as Data URL (base64)
 * Suitable for embedding in HTML or storing in database
 */
export async function generateQrDataUrl(
  text: string,
  options: QrImageOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    return await QRCode.toDataURL(text, {
      width: opts.width,
      margin: opts.margin,
      errorCorrectionLevel: opts.errorCorrectionLevel,
      color: opts.color,
    });
  } catch (error) {
    console.error('QR code generation failed:', error);
    throw new Error(`Failed to generate QR code: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

/**
 * Generate QR code as PNG Blob
 * Suitable for file downloads
 */
export async function generateQrBlob(
  text: string,
  options: QrImageOptions = {}
): Promise<Blob> {
  const dataUrl = await generateQrDataUrl(text, options);
  
  // Convert data URL to blob
  const response = await fetch(dataUrl);
  return await response.blob();
}

/**
 * Generate QR code as Canvas element (browser only)
 * Useful for rendering in DOM
 */
export async function generateQrCanvas(
  text: string,
  options: QrImageOptions = {}
): Promise<HTMLCanvasElement> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const canvas = document.createElement('canvas');
  
  try {
    await QRCode.toCanvas(canvas, text, {
      width: opts.width,
      margin: opts.margin,
      errorCorrectionLevel: opts.errorCorrectionLevel,
      color: opts.color,
    });
    
    return canvas;
  } catch (error) {
    console.error('QR canvas generation failed:', error);
    throw new Error(`Failed to generate QR canvas: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

/**
 * Build WhatsApp deep link for QR code
 */
export function buildWhatsAppDeepLink(
  botNumber: string,
  payload: string
): string {
  const cleanNumber = botNumber.replace(/[^0-9]/g, '');
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(payload)}`;
}

/**
 * Generate QR code for table with WhatsApp deep link
 */
export async function generateTableQrCode(
  barId: string,
  tableLabel: string,
  botNumber: string,
  options: QrImageOptions = {}
): Promise<{
  dataUrl: string;
  deepLink: string;
  payload: string;
}> {
  const payload = `TABLE-${tableLabel.toUpperCase()}-BAR-${barId}`;
  const deepLink = buildWhatsAppDeepLink(botNumber, payload);
  const dataUrl = await generateQrDataUrl(deepLink, options);
  
  return { dataUrl, deepLink, payload };
}
