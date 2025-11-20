# EasyMo AI - WhatsApp Integration Configuration

## WhatsApp Business API Details

**Account Information:**
- **Phone Number ID**: `561637583695258`
- **Business Account ID**: `552732297926796`
- **Verification Token**: `easymo_verify_token_secure_123`
- **API Version**: `v21.0`

## Webhook Configuration

### Webhook URL (After Deployment)
```
https://easymo-webhook-[YOUR-ID].run.app/webhook/whatsapp
```

### Verification Steps

1. **Go to Meta Developer Console**
   - Visit: https://developers.facebook.com/apps
   - Select your app
   - Navigate to WhatsApp > Configuration

2. **Configure Webhook**
   - Click "Edit" on Webhook section
   - **Callback URL**: Paste your Cloud Run webhook URL
   - **Verify Token**: `easymo_verify_token_secure_123`
   - Click "Verify and Save"

3. **Subscribe to Webhook Fields**
   - Check the `messages` field
   - This enables message receiving

### Webhook Verification Process

The webhook implements Meta's verification flow:

```python
# GET request to verify webhook
@app.get("/webhook/whatsapp")
async def whatsapp_verify(request: Request):
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")
    
    if mode == "subscribe" and token == WHATSAPP_VERIFY_TOKEN:
        return PlainTextResponse(challenge)
    
    raise HTTPException(status_code=403)
```

## Message Types Supported

### 1. Text Messages
```json
{
  "type": "text",
  "text": {
    "body": "Message content"
  }
}
```

### 2. Media Messages
- **Images**: JPEG, PNG
- **Videos**: MP4
- **Audio**: AAC, MP3, OGG
- **Documents**: PDF, DOC, DOCX

### 3. Interactive Messages
- **Buttons**: Up to 3 buttons
- **Lists**: Sections with multiple items
- **Reply Buttons**: Quick reply options

## Sending Messages

### Text Message
```python
await whatsapp_handler.send_text_message(
    to="250788123456",
    text="Muraho! Ese nshobora kukufasha?"
)
```

### Template Message
```python
await whatsapp_handler.send_template_message(
    to="250788123456",
    template_name="welcome_message",
    language_code="rw"
)
```

### Interactive Buttons
```python
await whatsapp_handler.send_interactive_buttons(
    to="250788123456",
    body_text="Hitamo icyo ushaka kumenya:",
    buttons=[
        {"id": "1", "title": "Ubwishingizi"},
        {"id": "2", "title": "Transport"},
        {"id": "3", "title": "AI Broker"}
    ],
    header_text="EasyMo Services"
)
```

### Interactive List
```python
await whatsapp_handler.send_interactive_list(
    to="250788123456",
    body_text="Hitamo serivisi:",
    button_text="Reba andi",
    sections=[
        {
            "title": "Insurance",
            "rows": [
                {"id": "ins1", "title": "Basic Plan", "description": "RWF 5,000/month"},
                {"id": "ins2", "title": "Premium Plan", "description": "RWF 20,000/month"}
            ]
        }
    ]
)
```

## Message Processing Flow

```
1. WhatsApp → Meta Servers → Your Webhook
2. Webhook receives POST /webhook/whatsapp
3. Extract message details
4. Create/update Firestore session
5. Generate AI response via Gemini
6. Send response back via WhatsApp API
7. Log to Firestore (whatsapp_messages collection)
```

## Testing Webhook Locally

### Using ngrok
```bash
# Start ngrok tunnel
ngrok http 8080

# Update WhatsApp webhook URL to ngrok URL
# Example: https://abc123.ngrok.io/webhook/whatsapp
```

### Test Message Payload
```bash
curl -X POST https://your-webhook-url/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "id": "test_001",
            "from": "250788123456",
            "type": "text",
            "text": {"body": "Muraho"}
          }]
        }
      }]
    }]
  }'
```

## Message Status Tracking

The system tracks these message statuses:
- `sent` - Message sent to Meta
- `delivered` - Delivered to recipient
- `read` - Read by recipient
- `failed` - Failed to deliver

All stored in Firestore `whatsapp_messages` collection.

## Rate Limits

WhatsApp Business API rate limits:
- **1000 messages/second** per phone number
- **Tier 1**: 1,000 unique users/day
- **Tier 2**: 10,000 unique users/day
- **Tier 3**: 100,000 unique users/day

Request tier upgrade in Meta Business Manager.

## Access Token Management

### Getting Access Token
1. Go to Meta Business Manager
2. Navigate to System Users
3. Generate token with permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`

### Storing Token
```bash
# Store in Google Secret Manager
echo -n "YOUR_ACCESS_TOKEN" | \
  gcloud secrets versions add whatsapp_api_key --data-file=-
```

### Token Expiry
- System User tokens: **60 days** or **Never expires** (recommended)
- Regular tokens: **24 hours**

Use **System User permanent tokens** for production.

## Troubleshooting

### Webhook Not Receiving Messages
1. Check webhook URL is correct in Meta console
2. Verify token matches exactly
3. Ensure webhook is publicly accessible
4. Check Cloud Run logs: `gcloud run logs read easymo-webhook`

### Messages Not Sending
1. Check access token is valid
2. Verify phone number is approved
3. Check rate limits not exceeded
4. Review error logs in Firestore

### Verification Failing
1. Ensure verify token matches exactly (case-sensitive)
2. Check webhook responds to GET requests
3. Verify Cloud Run service is allowing unauthenticated requests

## Monitoring

### View Webhook Logs
```bash
gcloud run logs read easymo-webhook \
  --region=us-central1 \
  --project=easymo-478117 \
  --limit=50
```

### Check Message Stats
```bash
# Get WhatsApp analytics
curl https://easymo-admin-api-[ID].run.app/analytics/whatsapp?days=7
```

### Firestore Queries
```python
# Query recent messages
messages = db.collection("whatsapp_messages") \
  .order_by("created_at", direction="DESCENDING") \
  .limit(50) \
  .stream()
```

## Security Best Practices

1. **Never commit access tokens** to Git
2. **Use Secret Manager** for all credentials
3. **Validate webhook signatures** (implement HMAC validation)
4. **Rate limit** your webhook endpoints
5. **Monitor** for unusual activity
6. **Rotate tokens** periodically

## Additional Resources

- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Firestore Documentation](https://cloud.google.com/firestore/docs)
- [Meta Business Manager](https://business.facebook.com)
