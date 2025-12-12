/**
 * Media Upload Handler for Marketplace
 * 
 * Handles photo uploads from WhatsApp messages for marketplace listings.
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import { logStructuredEvent } from "../_shared/observability.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import type { MarketplaceContext } from "./types.ts";

const WA_PHONE_ID = Deno.env.get("WA_PHONE_NUMBER_ID") || "";
const WA_ACCESS_TOKEN = Deno.env.get("WA_ACCESS_TOKEN") || "";

interface WhatsAppMediaMessage {
  type: "image" | "document" | "video";
  image?: { id: string; mime_type?: string; caption?: string };
  document?: { id: string; mime_type?: string; filename?: string };
  video?: { id: string; mime_type?: string; caption?: string };
}

/**
 * Download media from WhatsApp servers
 */
async function downloadWhatsAppMedia(mediaId: string): Promise<Blob> {
  try {
    // Step 1: Get media URL
    const urlResponse = await fetch(
      `https://graph.facebook.com/v18.0/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
        },
      }
    );

    if (!urlResponse.ok) {
      throw new Error(`Failed to get media URL: ${urlResponse.statusText}`);
    }

    const urlData = await urlResponse.json();
    const mediaUrl = urlData.url;

    // Step 2: Download media file
    const mediaResponse = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
      },
    });

    if (!mediaResponse.ok) {
      throw new Error(`Failed to download media: ${mediaResponse.statusText}`);
    }

    await logStructuredEvent("MEDIA_DOWNLOADED", {
      mediaId,
      mimeType: urlData.mime_type,
      fileSize: urlData.file_size,
    });

    return await mediaResponse.blob();
  } catch (error) {
    await logStructuredEvent(
      "MEDIA_DOWNLOAD_ERROR",
      {
        mediaId,
        error: error instanceof Error ? error.message : String(error),
      },
      "error"
    );
    throw error;
  }
}

/**
 * Upload image to Supabase Storage
 */
async function uploadToStorage(
  supabase: SupabaseClient,
  blob: Blob,
  listingId: string,
  phone: string
): Promise<string> {
  const timestamp = Date.now();
  const sanitizedPhone = phone.replace(/[^0-9]/g, "");
  const fileName = `${sanitizedPhone}/${listingId}/${timestamp}.jpg`;

  const { data, error } = await supabase.storage
    .from("marketplace-images")
    .upload(fileName, blob, {
      contentType: blob.type || "image/jpeg",
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("marketplace-images")
    .getPublicUrl(data.path);

  await logStructuredEvent("MEDIA_UPLOADED", {
    listingId,
    phone: sanitizedPhone.slice(-4),
    path: data.path,
  });

  return urlData.publicUrl;
}

/**
 * Handle media upload from WhatsApp message
 */
export async function handleMediaUpload(
  userPhone: string,
  message: WhatsAppMediaMessage,
  context: MarketplaceContext,
  supabase: SupabaseClient
): Promise<string> {
  try {
    // Validate that we're in a flow where photos are expected
    if (!context.currentListingId) {
      return (
        "📸 I can only accept photos when you're creating a listing.\n\n" +
        "Please tell me what you want to sell first!"
      );
    }

    // Extract media ID based on message type
    let mediaId: string | null = null;
    let caption: string | null = null;

    if (message.type === "image" && message.image) {
      mediaId = message.image.id;
      caption = message.image.caption || null;
    } else if (message.type === "document" && message.document) {
      mediaId = message.document.id;
    } else if (message.type === "video" && message.video) {
      return "📹 Video uploads aren't supported yet. Please send photos only.";
    }

    if (!mediaId) {
      return "❌ Couldn't process the media. Please try again.";
    }

    // Download from WhatsApp
    const blob = await downloadWhatsAppMedia(mediaId);

    // Upload to Supabase Storage
    const publicUrl = await uploadToStorage(
      supabase,
      blob,
      context.currentListingId,
      userPhone
    );

    // Update listing with new photo
    const { data: currentListing, error: fetchError } = await supabase
      .from("marketplace_listings")
      .select("photos")
      .eq("id", context.currentListingId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch listing: ${fetchError.message}`);
    }

    const updatedPhotos = [...(currentListing?.photos || []), publicUrl];

    const { error: updateError } = await supabase
      .from("marketplace_listings")
      .update({
        photos: updatedPhotos,
        updated_at: new Date().toISOString(),
      })
      .eq("id", context.currentListingId);

    if (updateError) {
      throw new Error(`Failed to update listing: ${updateError.message}`);
    }

    const photoCount = updatedPhotos.length;

    await logStructuredEvent("LISTING_PHOTO_ADDED", {
      listingId: context.currentListingId,
      phone: userPhone.slice(-4),
      photoCount,
    });

    return (
      `✅ Photo ${photoCount} uploaded successfully!\n\n` +
      (caption ? `Caption: "${caption}"\n\n` : "") +
      "Would you like to:\n" +
      "• Send another photo\n" +
      "• Type 'done' to finish and publish your listing"
    );
  } catch (error) {
    await logStructuredEvent(
      "MEDIA_UPLOAD_ERROR",
      {
        phone: userPhone.slice(-4),
        error: error instanceof Error ? error.message : String(error),
      },
      "error"
    );

    return (
      "❌ Sorry, I couldn't upload the photo. Please try again.\n\n" +
      "If the problem continues, you can skip photos by typing 'done'."
    );
  }
}

/**
 * Create storage bucket if it doesn't exist
 */
export async function ensureStorageBucket(
  supabase: SupabaseClient
): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();

  const bucketExists = buckets?.some((b) => b.name === "marketplace-images");

  if (!bucketExists) {
    const { error } = await supabase.storage.createBucket("marketplace-images", {
      public: true,
      fileSizeLimit: 5242880, // 5MB
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });

    if (error && !error.message.includes("already exists")) {
      throw new Error(`Failed to create bucket: ${error.message}`);
    }

    await logStructuredEvent("STORAGE_BUCKET_CREATED", {
      bucket: "marketplace-images",
    });
  }
}
