/**
 * Storage Operations Helper
 * Handles Supabase Storage bucket operations
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { logStructuredEvent } from "../../_shared/observability.ts";

/**
 * Create signed URL for storage object
 */
export async function createSignedUrl(
  client: SupabaseClient,
  bucketName: string,
  path: string,
  expiresIn: number = 600, // 10 minutes default
): Promise<string> {
  const trimmedPath = path.replace(/^\/+/, "");

  const { data, error } = await client.storage
    .from(bucketName)
    .createSignedUrl(trimmedPath, expiresIn);

  if (error || !data?.signedUrl) {
    await logStructuredEvent("STORAGE_SIGNED_URL_ERROR", {
      bucket: bucketName,
      path: trimmedPath,
      error: error?.message ?? "No signed URL returned",
    }, "error");
    throw new Error(`Failed to create signed URL: ${error?.message ?? "Unknown error"}`);
  }

  return data.signedUrl;
}

/**
 * Download file from storage as base64
 */
export async function downloadAsBase64(
  client: SupabaseClient,
  bucketName: string,
  path: string,
): Promise<{ base64Data: string; contentType: string }> {
  const trimmedPath = path.replace(/^\/+/, "");

  const { data, error } = await client.storage
    .from(bucketName)
    .download(trimmedPath);

  if (error || !data) {
    await logStructuredEvent("STORAGE_DOWNLOAD_ERROR", {
      bucket: bucketName,
      path: trimmedPath,
      error: error?.message ?? "No data returned",
    }, "error");
    throw new Error(`Failed to download file: ${error?.message ?? "Unknown error"}`);
  }

  const bytes = new Uint8Array(await data.arrayBuffer());
  const base64Data = bytesToBase64(bytes);
  const contentType = data.type || "application/octet-stream";

  return { base64Data, contentType };
}

/**
 * Upload file to storage
 */
export async function uploadFile(
  client: SupabaseClient,
  bucketName: string,
  path: string,
  content: string | Uint8Array,
  options: {
    contentType?: string;
    upsert?: boolean;
  } = {},
): Promise<string> {
  const trimmedPath = path.replace(/^\/+/, "");

  const { data, error } = await client.storage
    .from(bucketName)
    .upload(trimmedPath, content, {
      contentType: options.contentType ?? "application/octet-stream",
      upsert: options.upsert ?? false,
    });

  if (error) {
    await logStructuredEvent("STORAGE_UPLOAD_ERROR", {
      bucket: bucketName,
      path: trimmedPath,
      error: error.message,
    }, "error");
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return data.path;
}

/**
 * Convert Uint8Array to base64 string
 * Handles large files by processing in chunks
 */
function bytesToBase64(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";

  const chunkSize = 0x8000; // 32KB chunks
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const slice = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...slice);
  }

  return btoa(binary);
}
