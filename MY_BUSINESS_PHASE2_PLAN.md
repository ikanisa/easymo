# 🚀 My Business Workflow - Phase 2 Implementation Plan

**Phase:** Menu Upload with AI OCR  
**Estimated Time:** 3-4 days  
**Status:** 📋 Ready to Start  
**Prerequisites:** ✅ Phase 1 Complete

---

## 📋 Phase 2 Overview

### Goal
Implement AI-powered menu upload functionality using Gemini Vision API, allowing restaurant owners to upload menu images/PDFs and automatically extract menu items with prices.

### Key Features
1. ✅ Image/PDF upload via WhatsApp
2. ✅ AI OCR processing (Gemini Vision)
3. ✅ Extracted items review & editing
4. ✅ Bulk import to menu_items table
5. ✅ Menu versioning & history

---

## 🗓️ Implementation Roadmap

### Day 1: Database & Infrastructure (6-8 hours)

#### Task 1.1: Create Menu Upload Tables (2 hours)

**File:** `supabase/migrations/YYYYMMDD_menu_upload_system.sql`

```sql
BEGIN;

-- Menu upload requests tracking
CREATE TABLE IF NOT EXISTS menu_upload_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  
  -- WhatsApp media details
  media_id TEXT NOT NULL,
  media_type TEXT NOT NULL, -- 'image', 'document'
  media_mime_type TEXT,
  media_url TEXT,
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Uploaded, awaiting processing
    'processing',   -- AI OCR in progress
    'review',       -- Ready for user review
    'approved',     -- User approved, ready to import
    'imported',     -- Successfully imported to menu_items
    'failed',       -- Processing failed
    'rejected'      -- User rejected
  )),
  
  -- AI OCR results
  ocr_result JSONB,
  extracted_items JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  error_message TEXT,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_menu_uploads_bar ON menu_upload_requests(bar_id);
CREATE INDEX idx_menu_uploads_status ON menu_upload_requests(status);
CREATE INDEX idx_menu_uploads_created ON menu_upload_requests(created_at DESC);

-- Menu versions (for rollback)
CREATE TABLE IF NOT EXISTS menu_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(user_id),
  
  -- Snapshot of menu_items at this version
  menu_snapshot JSONB NOT NULL,
  item_count INTEGER NOT NULL,
  
  -- Metadata
  description TEXT,
  source TEXT DEFAULT 'manual', -- 'manual', 'upload', 'bulk_import'
  upload_request_id UUID REFERENCES menu_upload_requests(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(bar_id, version_number)
);

CREATE INDEX idx_menu_versions_bar ON menu_versions(bar_id);
CREATE INDEX idx_menu_versions_created ON menu_versions(created_at DESC);

-- RLS Policies
ALTER TABLE menu_upload_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_versions ENABLE ROW LEVEL SECURITY;

-- Bar managers can view/manage uploads for their bars
CREATE POLICY "Bar managers can manage uploads" ON menu_upload_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM bar_managers
      WHERE bar_managers.bar_id = menu_upload_requests.bar_id
      AND bar_managers.user_id = auth.uid()
      AND bar_managers.is_active = true
    )
  );

-- Bar managers can view menu versions
CREATE POLICY "Bar managers can view versions" ON menu_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bar_managers
      WHERE bar_managers.bar_id = menu_versions.bar_id
      AND bar_managers.user_id = auth.uid()
      AND bar_managers.is_active = true
    )
  );

COMMIT;
```

**Checklist:**
- [ ] Create migration file
- [ ] Test migration locally (`supabase db reset`)
- [ ] Verify indexes created
- [ ] Test RLS policies

---

#### Task 1.2: Add Menu Upload Handler Placeholder (1 hour)

**File:** `supabase/functions/wa-webhook/domains/vendor/restaurant.ts`

Update `promptMenuUpload()` function:

```typescript
async function promptMenuUpload(
  ctx: RouterContext,
  state: RestaurantManagerState
): Promise<boolean> {
  if (!state.barId || !ctx.profileId) return false;
  
  await setState(ctx.supabase, ctx.profileId, {
    key: "menu_upload_awaiting_image",
    data: { 
      barId: state.barId,
      returnTo: "restaurant_manager"
    },
  });
  
  await sendButtonsMessage(
    ctx,
    "📷 *Upload Your Menu*\n\n" +
    "Send a clear photo or PDF of your menu. I'll extract:\n" +
    "• Item names\n" +
    "• Prices (with currency)\n" +
    "• Categories (if visible)\n\n" +
    "*Supported formats:* JPG, PNG, PDF\n" +
    "*Tip:* Good lighting and clear text work best!",
    buildButtons(
      { id: IDS.RESTAURANT_MANAGER, title: "← Cancel" }
    )
  );
  
  await logStructuredEvent("MENU_UPLOAD_PROMPT", {
    barId: state.barId,
    userId: ctx.profileId,
  });
  
  return true;
}
```

**Checklist:**
- [ ] Update function implementation
- [ ] Add state management
- [ ] Add observability logging
- [ ] Test cancel flow

---

### Day 2: OCR Processing Engine (8-10 hours)

#### Task 2.1: Create OCR Processor Edge Function (4 hours)

**File:** `supabase/functions/ocr-menu-processor/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.3";
import { logStructuredEvent } from "../_shared/observability.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY")!);

interface MenuItem {
  name: string;
  price: number;
  currency?: string;
  category?: string;
  description?: string;
}

serve(async (req: Request) => {
  try {
    const { requestId, mediaId, barId } = await req.json();
    
    await logStructuredEvent("OCR_PROCESSING_START", { requestId, mediaId });
    
    // Update status to processing
    await supabase
      .from("menu_upload_requests")
      .update({ 
        status: "processing",
        processing_started_at: new Date().toISOString()
      })
      .eq("id", requestId);
    
    // 1. Download image from WhatsApp
    const imageBuffer = await downloadWhatsAppMedia(mediaId);
    
    // 2. Process with Gemini Vision
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-vision" });
    
    const prompt = `
You are a menu extraction expert. Analyze this menu image and extract ALL menu items in JSON format.

For each item, extract:
- name: Item name (required)
- price: Numeric price (required)
- currency: Currency code (default: RWF)
- category: Food category if visible (e.g., "Appetizers", "Main Course", "Drinks")
- description: Item description if available

Return ONLY valid JSON array with this exact structure:
[
  {
    "name": "Pizza Margherita",
    "price": 8000,
    "currency": "RWF",
    "category": "Main Course",
    "description": "Tomato, mozzarella, basil"
  }
]

Important:
- Extract prices as numbers only (remove currency symbols)
- If currency not visible, assume RWF
- If category not clear, use "Uncategorized"
- Include ALL items you can see
- Ensure valid JSON format
`;

    const imagePart = {
      inlineData: {
        data: arrayBufferToBase64(imageBuffer),
        mimeType: "image/jpeg"
      }
    };
    
    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response.text();
    
    // 3. Parse JSON response
    let extractedItems: MenuItem[] = [];
    try {
      // Clean response (remove markdown code blocks if present)
      const cleanJson = response
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      
      extractedItems = JSON.parse(cleanJson);
      
      // Validate items
      extractedItems = extractedItems.filter(item => 
        item.name && item.price && item.price > 0
      );
      
    } catch (parseError) {
      await logStructuredEvent("OCR_PARSE_ERROR", { 
        requestId, 
        error: parseError.message,
        rawResponse: response.slice(0, 500)
      });
      
      throw new Error("Failed to parse AI response");
    }
    
    // 4. Update database with results
    await supabase
      .from("menu_upload_requests")
      .update({
        status: "review",
        ocr_result: { raw: response },
        extracted_items: extractedItems,
        processing_completed_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    
    await logStructuredEvent("OCR_PROCESSING_COMPLETE", {
      requestId,
      itemsExtracted: extractedItems.length,
    });
    
    // 5. Notify user via WhatsApp
    await notifyUser(barId, requestId, extractedItems.length);
    
    return new Response(
      JSON.stringify({ success: true, items: extractedItems.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    await logStructuredEvent("OCR_PROCESSING_ERROR", {
      error: error.message
    }, "error");
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

async function downloadWhatsAppMedia(mediaId: string): Promise<ArrayBuffer> {
  const accessToken = Deno.env.get("WA_ACCESS_TOKEN")!;
  
  // Get media URL
  const mediaResp = await fetch(
    `https://graph.facebook.com/v18.0/${mediaId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const mediaData = await mediaResp.json();
  
  // Download actual file
  const fileResp = await fetch(mediaData.url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  return await fileResp.arrayBuffer();
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function notifyUser(barId: string, requestId: string, itemCount: number) {
  // Get bar manager's phone
  const { data: manager } = await supabase
    .from("bar_managers")
    .select("user_id, profiles(phone_number)")
    .eq("bar_id", barId)
    .eq("is_active", true)
    .single();
  
  if (!manager?.profiles?.phone_number) return;
  
  // Send WhatsApp notification
  await supabase.functions.invoke("wa-send-message", {
    body: {
      to: manager.profiles.phone_number,
      message: `✅ Menu processed! ${itemCount} items found.\n\nTap "Manage Menu" → "Review Upload" to approve.`
    }
  });
}
```

**Checklist:**
- [ ] Create edge function
- [ ] Add Gemini API integration
- [ ] Implement media download
- [ ] Add JSON parsing with error handling
- [ ] Test with sample menu images
- [ ] Deploy function: `supabase functions deploy ocr-menu-processor`

---

#### Task 2.2: Handle Image Upload in Restaurant Manager (2 hours)

**File:** `supabase/functions/wa-webhook/domains/vendor/restaurant.ts`

Add handler for image/document uploads:

```typescript
export async function handleMenuImageUpload(
  ctx: RouterContext,
  message: any,
  state: any
): Promise<boolean> {
  if (!ctx.profileId || !state.data?.barId) return false;
  
  const mediaId = message.image?.id || message.document?.id;
  const mediaType = message.image ? "image" : "document";
  const mimeType = message.image?.mime_type || message.document?.mime_type;
  
  if (!mediaId) return false;
  
  await sendText(ctx.from, "⏳ Processing your menu with AI...\nThis may take 10-30 seconds.");
  
  // Create upload request
  const { data: uploadRequest, error } = await ctx.supabase
    .from("menu_upload_requests")
    .insert({
      bar_id: state.data.barId,
      uploaded_by: ctx.profileId,
      media_id: mediaId,
      media_type: mediaType,
      media_mime_type: mimeType,
      status: "pending",
    })
    .select()
    .single();
  
  if (error || !uploadRequest) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Failed to save upload request. Please try again.",
      buildButtons({ id: IDS.RESTAURANT_MANAGER, title: "← Back" })
    );
    return true;
  }
  
  // Invoke OCR processor (async)
  await ctx.supabase.functions.invoke("ocr-menu-processor", {
    body: {
      requestId: uploadRequest.id,
      mediaId,
      barId: state.data.barId,
    },
  });
  
  await clearState(ctx.supabase, ctx.profileId);
  
  await sendButtonsMessage(
    ctx,
    "✅ *Menu uploaded successfully!*\n\n" +
    "AI is analyzing your menu now. You'll receive a notification when it's ready for review.\n\n" +
    "💡 *Tip:* You can continue using other features while processing.",
    buildButtons(
      { id: IDS.RESTAURANT_MANAGER, title: "🍽️ Back to Menu Manager" },
      { id: IDS.BACK_HOME, title: "🏠 Home" }
    )
  );
  
  await logStructuredEvent("MENU_UPLOAD_SUBMITTED", {
    uploadId: uploadRequest.id,
    barId: state.data.barId,
    userId: ctx.profileId,
  });
  
  return true;
}
```

**Checklist:**
- [ ] Add function to restaurant.ts
- [ ] Integrate with profile index.ts
- [ ] Test with sample images
- [ ] Verify async processing

---

### Day 3: Review & Import Flow (8-10 hours)

#### Task 3.1: Review Uploaded Menu UI (4 hours)

**File:** `supabase/functions/wa-webhook/domains/vendor/restaurant.ts`

```typescript
async function showMenuUploadReview(
  ctx: RouterContext,
  requestId: string
): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  const { data: request, error } = await ctx.supabase
    .from("menu_upload_requests")
    .select("*, bars(name)")
    .eq("id", requestId)
    .single();
  
  if (error || !request) {
    await sendText(ctx.from, "⚠️ Upload request not found.");
    return true;
  }
  
  if (request.status !== "review") {
    const statusMsg = {
      pending: "⏳ Still pending processing...",
      processing: "⚙️ AI is currently processing your menu...",
      failed: "❌ Processing failed. Please try uploading again.",
      imported: "✅ Already imported to your menu.",
    }[request.status] || "Unknown status";
    
    await sendButtonsMessage(
      ctx,
      statusMsg,
      buildButtons({ id: IDS.RESTAURANT_MANAGER, title: "← Back" })
    );
    return true;
  }
  
  const items = request.extracted_items as MenuItem[];
  
  if (!items || items.length === 0) {
    await sendButtonsMessage(
      ctx,
      "😔 No items were found in your menu image.\n\n" +
      "Please try again with:\n" +
      "• Better lighting\n" +
      "• Clearer text\n" +
      "• Higher resolution image",
      buildButtons(
        { id: IDS.RESTAURANT_UPLOAD_MENU, title: "📷 Try Again" },
        { id: IDS.RESTAURANT_MANAGER, title: "← Back" }
      )
    );
    return true;
  }
  
  // Show preview (first 5 items)
  const preview = items
    .slice(0, 5)
    .map((item, idx) => 
      `${idx + 1}. *${item.name}*\n   ${item.price} ${item.currency || "RWF"}${item.category ? `\n   📂 ${item.category}` : ""}`
    )
    .join("\n\n");
  
  const message = `📋 *${items.length} Items Found*\n\n` +
    `Restaurant: ${request.bars?.name}\n\n` +
    `*Preview (showing first 5):*\n\n${preview}` +
    (items.length > 5 ? `\n\n_...and ${items.length - 5} more items_` : "");
  
  await sendListMessage(
    ctx,
    {
      title: "Review Menu Upload",
      body: message,
      sectionTitle: "Actions",
      buttonText: "Choose",
      rows: [
        {
          id: `IMPORT_MENU::${requestId}`,
          title: "✅ Import All",
          description: `Add ${items.length} items to your menu`,
        },
        {
          id: `PREVIEW_MENU::${requestId}`,
          title: "👀 View All Items",
          description: "See complete list before importing",
        },
        {
          id: `REJECT_MENU::${requestId}`,
          title: "❌ Reject",
          description: "Discard and try again",
        },
        {
          id: IDS.RESTAURANT_MANAGER,
          title: "← Back",
          description: "Return to menu manager",
        },
      ],
    },
    { emoji: "📋" }
  );
  
  return true;
}
```

**Checklist:**
- [ ] Implement review function
- [ ] Add preview display
- [ ] Handle all statuses
- [ ] Test with various item counts

---

#### Task 3.2: Bulk Import Implementation (3 hours)

**File:** `supabase/functions/wa-webhook/domains/vendor/restaurant.ts`

```typescript
async function handleMenuImport(
  ctx: RouterContext,
  requestId: string
): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  // Get upload request
  const { data: request } = await ctx.supabase
    .from("menu_upload_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  
  if (!request || request.status !== "review") {
    await sendText(ctx.from, "⚠️ Cannot import this upload.");
    return true;
  }
  
  const items = request.extracted_items as MenuItem[];
  
  await sendText(ctx.from, `⏳ Importing ${items.length} items...`);
  
  try {
    // 1. Create menu version snapshot (before import)
    const { data: currentMenu } = await ctx.supabase
      .from("menu_items")
      .select("*")
      .eq("bar_id", request.bar_id);
    
    const { data: latestVersion } = await ctx.supabase
      .from("menu_versions")
      .select("version_number")
      .eq("bar_id", request.bar_id)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();
    
    const nextVersion = (latestVersion?.version_number || 0) + 1;
    
    await ctx.supabase
      .from("menu_versions")
      .insert({
        bar_id: request.bar_id,
        version_number: nextVersion,
        created_by: ctx.profileId,
        menu_snapshot: currentMenu || [],
        item_count: currentMenu?.length || 0,
        description: `Pre-upload snapshot`,
        source: "upload",
        upload_request_id: requestId,
      });
    
    // 2. Bulk insert menu items
    const menuItemsToInsert = items.map(item => ({
      bar_id: request.bar_id,
      name: item.name,
      price: item.price,
      currency: item.currency || "RWF",
      category_name: item.category || "Uncategorized",
      description: item.description || null,
      is_available: true,
    }));
    
    const { data: inserted, error: insertError } = await ctx.supabase
      .from("menu_items")
      .insert(menuItemsToInsert)
      .select();
    
    if (insertError) throw insertError;
    
    // 3. Update upload request status
    await ctx.supabase
      .from("menu_upload_requests")
      .update({
        status: "imported",
        imported_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    
    // 4. Create post-import snapshot
    await ctx.supabase
      .from("menu_versions")
      .insert({
        bar_id: request.bar_id,
        version_number: nextVersion + 1,
        created_by: ctx.profileId,
        menu_snapshot: inserted,
        item_count: inserted.length,
        description: `After upload import (+${items.length} items)`,
        source: "upload",
        upload_request_id: requestId,
      });
    
    await sendButtonsMessage(
      ctx,
      `✅ *Import Successful!*\n\n` +
      `Added ${inserted.length} items to your menu.\n\n` +
      `💡 *Tip:* You can edit individual items in "Edit Menu"`,
      buildButtons(
        { id: IDS.RESTAURANT_EDIT_MENU, title: "✏️ Edit Menu" },
        { id: IDS.RESTAURANT_MANAGER, title: "🍽️ Menu Manager" },
        { id: IDS.BACK_HOME, title: "🏠 Home" }
      )
    );
    
    await logStructuredEvent("MENU_IMPORT_SUCCESS", {
      barId: request.bar_id,
      itemsImported: inserted.length,
      uploadId: requestId,
    });
    
    return true;
    
  } catch (error) {
    await logStructuredEvent("MENU_IMPORT_ERROR", {
      error: error.message,
      requestId,
    }, "error");
    
    await sendButtonsMessage(
      ctx,
      `❌ Import failed: ${error.message}\n\nPlease try again or contact support.`,
      buildButtons({ id: IDS.RESTAURANT_MANAGER, title: "← Back" })
    );
    
    return true;
  }
}
```

**Checklist:**
- [ ] Implement bulk import
- [ ] Add version snapshots
- [ ] Handle duplicate items
- [ ] Test transaction rollback
- [ ] Add error handling

---

### Day 4: Integration & Testing (6-8 hours)

#### Task 4.1: Wire Upload Flow to Router (2 hours)

**File:** `supabase/functions/wa-webhook-profile/index.ts`

Add handlers for upload review actions:

```typescript
// Menu upload review
else if (id.startsWith("IMPORT_MENU::")) {
  const requestId = id.replace("IMPORT_MENU::", "");
  const { handleMenuImport } = await import(
    "../wa-webhook/domains/vendor/restaurant.ts"
  );
  handled = await handleMenuImport(ctx, requestId);
}
else if (id.startsWith("PREVIEW_MENU::")) {
  const requestId = id.replace("PREVIEW_MENU::", "");
  const { showMenuUploadPreview } = await import(
    "../wa-webhook/domains/vendor/restaurant.ts"
  );
  handled = await showMenuUploadPreview(ctx, requestId);
}
else if (id.startsWith("REJECT_MENU::")) {
  const requestId = id.replace("REJECT_MENU::", "");
  const { handleMenuReject } = await import(
    "../wa-webhook/domains/vendor/restaurant.ts"
  );
  handled = await handleMenuReject(ctx, requestId);
}

// Handle image/document upload when in menu_upload_awaiting_image state
else if (
  (message.type === "image" || message.type === "document") &&
  state?.key === "menu_upload_awaiting_image"
) {
  const { handleMenuImageUpload } = await import(
    "../wa-webhook/domains/vendor/restaurant.ts"
  );
  handled = await handleMenuImageUpload(ctx, message, state);
}
```

**Checklist:**
- [ ] Add routing handlers
- [ ] Test image upload flow
- [ ] Test review flow
- [ ] Test import flow
- [ ] Test rejection flow

---

#### Task 4.2: End-to-End Testing (4 hours)

**Test Cases:**

1. **Happy Path:**
   - [ ] Upload clear menu image
   - [ ] AI extracts items correctly
   - [ ] Review shows all items
   - [ ] Import adds items to database
   - [ ] Menu editor shows new items

2. **Edge Cases:**
   - [ ] Upload unclear image (low quality)
   - [ ] Upload non-menu image
   - [ ] Upload PDF document
   - [ ] Upload menu with no prices visible
   - [ ] Upload menu in different currency

3. **Error Cases:**
   - [ ] Network timeout during upload
   - [ ] AI processing failure
   - [ ] Database error during import
   - [ ] Duplicate item handling
   - [ ] Cancel mid-upload

**Testing Script:**

```bash
# Test locally with sample images
cd supabase/functions/ocr-menu-processor
deno run --allow-net --allow-env index.ts

# Test with real WhatsApp
# 1. Profile → My Businesses → Restaurant → Manage Menu
# 2. Upload Menu
# 3. Send sample menu image
# 4. Wait for processing (10-30s)
# 5. Review extracted items
# 6. Import
# 7. Verify in Edit Menu
```

**Checklist:**
- [ ] Run all test cases
- [ ] Document issues found
- [ ] Fix critical bugs
- [ ] Performance test (large menus)
- [ ] Load test (multiple uploads)

---

## 📊 Success Metrics (Phase 2)

### KPIs (Week 1-2)
- [ ] **Upload Rate:** 50% of restaurants upload menu within 2 weeks
- [ ] **OCR Accuracy:** 85%+ items extracted correctly
- [ ] **Import Success:** 70%+ uploads result in successful import
- [ ] **Processing Time:** < 30 seconds average
- [ ] **Error Rate:** < 10% failed uploads

### Analytics Queries

```sql
-- Upload statistics
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_uploads,
  COUNT(*) FILTER (WHERE status = 'imported') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  AVG(EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at))) as avg_processing_time
FROM menu_upload_requests
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Extraction accuracy
SELECT 
  requestId,
  jsonb_array_length(extracted_items) as items_extracted,
  (SELECT COUNT(*) FROM menu_items WHERE bar_id = menu_upload_requests.bar_id) as current_menu_size
FROM menu_upload_requests
WHERE status = 'imported';
```

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] Database migration tested locally
- [ ] OCR function deployed: `supabase functions deploy ocr-menu-processor`
- [ ] Environment variables set (GEMINI_API_KEY, WA_ACCESS_TOKEN)
- [ ] All tests passing
- [ ] Code review complete

### Deployment
```bash
# 1. Deploy database migration
supabase db push

# 2. Deploy edge functions
supabase functions deploy ocr-menu-processor
supabase functions deploy wa-webhook-profile
supabase functions deploy wa-webhook

# 3. Verify deployments
curl https://PROJECT.supabase.co/functions/v1/ocr-menu-processor/health
curl https://PROJECT.supabase.co/functions/v1/wa-webhook-profile/health

# 4. Test on staging first
# Send test menu image via WhatsApp staging

# 5. Monitor logs
supabase functions logs ocr-menu-processor --tail
```

### Post-Deployment
- [ ] Monitor error rates
- [ ] Check processing times
- [ ] Collect user feedback
- [ ] Document common issues

---

## 🐛 Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| OCR fails to extract items | Poor image quality | Add image quality validation, user guidance |
| Wrong prices extracted | AI misinterpretation | Add manual editing before import |
| Processing timeout | Large image file | Compress images, increase timeout |
| Duplicate items after import | No deduplication | Add duplicate detection logic |
| Wrong currency detected | Menu shows multiple currencies | Let user select default currency |

---

## 📞 Support Escalation

### L1: OCR Issues
- Check image quality (resolution, lighting)
- Verify Gemini API quota
- Review OCR logs

### L2: Import Issues
- Check database constraints
- Verify bar_id linkage
- Review transaction logs

### L3: Performance Issues
- Analyze processing times
- Check API rate limits
- Review database indexes

---

## 🎯 Next Steps After Phase 2

### Immediate Enhancements
- [ ] Add menu item images support
- [ ] Implement category auto-detection
- [ ] Add price range validation
- [ ] Support multiple currencies better

### Phase 3 Preview
- [ ] Desktop app authentication
- [ ] Real-time order notifications
- [ ] Two-way menu synchronization
- [ ] Order management workflow

---

**Estimated Timeline:** 3-4 days  
**Risk Level:** Medium (AI integration, new infrastructure)  
**Dependencies:** Phase 1 complete, Gemini API access  
**ROI:** High (major time saver for restaurant owners)

---

**Status:** 📋 Ready to Start  
**Next Action:** Begin Day 1 - Database & Infrastructure setup
