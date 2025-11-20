"""
EasyMo AI Sales Agent - Main Webhook Handler
Handles Dialogflow CX webhooks and WhatsApp Business API integration
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional

from fastapi import FastAPI, Request, HTTPException, Header
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from google.cloud import firestore, aiplatform
from google.cloud import secretmanager
import vertexai
from vertexai.generative_models import GenerativeModel, Part, Content
from vertexai.preview.generative_models import grounding

from whatsapp import WhatsAppHandler
from tools import ToolExecutor

# Configuration
PROJECT_ID = os.getenv("GCP_PROJECT", "easymo-478117")
LOCATION = os.getenv("GCP_REGION", "us-central1")
WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "easymo_verify_token_secure_123")

# Phone number ID and Business Account ID from Meta
WHATSAPP_PHONE_NUMBER_ID = "561637583695258"
WHATSAPP_BUSINESS_ACCOUNT_ID = "552732297926796"

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(title="EasyMo AI Webhook", version="1.0.0")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
db = firestore.Client(project=PROJECT_ID)
vertexai.init(project=PROJECT_ID, location=LOCATION)
secret_client = secretmanager.SecretManagerServiceClient()

# Initialize handlers
whatsapp_handler = WhatsAppHandler(
    phone_number_id=WHATSAPP_PHONE_NUMBER_ID,
    business_account_id=WHATSAPP_BUSINESS_ACCOUNT_ID,
    db=db
)
tool_executor = ToolExecutor(db=db)


def get_secret(secret_id: str) -> str:
    """Retrieve secret from Secret Manager"""
    try:
        name = f"projects/{PROJECT_ID}/secrets/{secret_id}/versions/latest"
        response = secret_client.access_secret_version(request={"name": name})
        return response.payload.data.decode('UTF-8')
    except Exception as e:
        logger.error(f"Failed to retrieve secret {secret_id}: {e}")
        return ""


# Load secrets
WHATSAPP_API_KEY = get_secret("whatsapp_api_key")
OPENAI_API_KEY = get_secret("openai_api_key")

# Configure WhatsApp handler with token
whatsapp_handler.access_token = WHATSAPP_API_KEY


# --- Gemini Configuration ---
GEMINI_MODEL = "gemini-2.5-flash-002"
GEMINI_THINKING_MODEL = "gemini-2.5-pro-002"

SYSTEM_INSTRUCTION = """
You are "EasyMo Agent", a highly skilled, persuasive, and friendly sales representative 
and broker for the Rwandan market.

**LANGUAGE PRIORITY:**
1. **Kinyarwanda (Primary):** You must be very fluent in Kinyarwanda. Start all 
   conversations in Kinyarwanda, as most locals prefer it. Use natural, local idioms.
2. **English & French (Secondary):** You are also fluent in English and French. 
   Only switch to these languages if the user speaks them first or struggles with Kinyarwanda.

**GOAL:**
Promote EasyMo services:
1. Insurance via WhatsApp
2. Instant chat with nearby drivers/passengers for trips
3. EasyMo AI Broker: Connecting buyers and sellers naturally

**YOUR TOOLS:**
- schedule_callback: Schedule a follow-up call
- search_inventory: Search for products/services
- create_lead: Create a qualified lead in the system
- send_brochure: Send marketing materials via WhatsApp

**BANT QUALIFICATION:**
- Budget: Can they afford it?
- Authority: Are they the decision maker?
- Need: Do they have a genuine need?
- Timing: When do they plan to buy?

Be professional, empathetic, and focused on building relationships.
"""


def create_session_document(session_id: str, metadata: Dict[str, Any]) -> None:
    """Create or update call session in Firestore"""
    try:
        session_ref = db.collection("call_sessions").document(session_id)
        session_data = {
            "session_id": session_id,
            "start_time": firestore.SERVER_TIMESTAMP,
            "status": "active",
            "conversation_history": [],
            "context_state": {},
            "bant_qualification": {
                "budget": "Unknown",
                "authority": "Unknown",
                "need": "Unknown",
                "timing": "Unknown"
            },
            "metadata": metadata,
            "updated_at": firestore.SERVER_TIMESTAMP
        }
        session_ref.set(session_data, merge=True)
        logger.info(f"Session created: {session_id}")
    except Exception as e:
        logger.error(f"Failed to create session: {e}")


def update_conversation_history(session_id: str, role: str, content: str) -> None:
    """Append message to conversation history"""
    try:
        session_ref = db.collection("call_sessions").document(session_id)
        session_ref.update({
            "conversation_history": firestore.ArrayUnion([{
                "role": role,
                "content": content,
                "timestamp": datetime.utcnow().isoformat()
            }]),
            "updated_at": firestore.SERVER_TIMESTAMP
        })
    except Exception as e:
        logger.error(f"Failed to update history: {e}")


def get_conversation_history(session_id: str) -> list:
    """Retrieve conversation history from Firestore"""
    try:
        session_ref = db.collection("call_sessions").document(session_id)
        session_doc = session_ref.get()
        if session_doc.exists:
            data = session_doc.to_dict()
            return data.get("conversation_history", [])
        return []
    except Exception as e:
        logger.error(f"Failed to get history: {e}")
        return []


async def generate_ai_response(
    user_message: str, 
    session_id: str,
    use_grounding: bool = False,
    use_thinking: bool = False
) -> str:
    """Generate response using Gemini with optional grounding and thinking"""
    try:
        # Get conversation history
        history = get_conversation_history(session_id)
        
        # Select model
        model_name = GEMINI_THINKING_MODEL if use_thinking else GEMINI_MODEL
        model = GenerativeModel(
            model_name=model_name,
            system_instruction=SYSTEM_INSTRUCTION
        )
        
        # Build conversation context
        contents = []
        for msg in history:
            role = "user" if msg["role"] == "user" else "model"
            contents.append(Content(role=role, parts=[Part.from_text(msg["content"])]))
        
        # Add current message
        contents.append(Content(role="user", parts=[Part.from_text(user_message)]))
        
        # Configure generation
        generation_config = {
            "temperature": 0.7,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 2048,
        }
        
        # Add grounding if requested
        tools = []
        if use_grounding:
            tools.append(
                grounding.Tool.from_google_search_retrieval(
                    grounding.GoogleSearchRetrieval()
                )
            )
        
        # Generate response
        if tools:
            response = model.generate_content(
                contents,
                generation_config=generation_config,
                tools=tools
            )
        else:
            response = model.generate_content(
                contents,
                generation_config=generation_config
            )
        
        ai_response = response.text
        
        # Update history
        update_conversation_history(session_id, "user", user_message)
        update_conversation_history(session_id, "assistant", ai_response)
        
        return ai_response
        
    except Exception as e:
        logger.error(f"AI generation error: {e}")
        return "Yampaye, ndagufasha ko nashobora. Ongera ugerageze."


# --- API Endpoints ---

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "EasyMo AI Webhook",
        "status": "healthy",
        "version": "1.0.0",
        "project_id": PROJECT_ID,
        "whatsapp_phone_id": WHATSAPP_PHONE_NUMBER_ID
    }


@app.get("/webhook/whatsapp")
async def whatsapp_verify(request: Request):
    """WhatsApp webhook verification"""
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")
    
    if mode == "subscribe" and token == WHATSAPP_VERIFY_TOKEN:
        logger.info("WhatsApp webhook verified successfully")
        return PlainTextResponse(challenge)
    
    logger.warning("WhatsApp webhook verification failed")
    raise HTTPException(status_code=403, detail="Verification failed")


@app.post("/webhook/whatsapp")
async def whatsapp_webhook(request: Request):
    """Handle incoming WhatsApp messages"""
    try:
        body = await request.json()
        logger.info(f"WhatsApp webhook received: {json.dumps(body, indent=2)}")
        
        # Process the webhook
        response = await whatsapp_handler.process_webhook(body)
        
        # Extract message if present
        if body.get("entry"):
            for entry in body["entry"]:
                if entry.get("changes"):
                    for change in entry["changes"]:
                        if change.get("value", {}).get("messages"):
                            for message in change["value"]["messages"]:
                                await handle_whatsapp_message(message, change["value"])
        
        return JSONResponse({"status": "success"})
        
    except Exception as e:
        logger.error(f"WhatsApp webhook error: {e}")
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)


async def handle_whatsapp_message(message: Dict, value: Dict):
    """Process individual WhatsApp message"""
    try:
        message_id = message.get("id")
        from_number = message.get("from")
        message_type = message.get("type")
        
        # Create session ID
        session_id = f"wa_{from_number}_{datetime.now().strftime('%Y%m%d')}"
        
        # Create session if needed
        create_session_document(session_id, {
            "channel": "whatsapp",
            "customer_phone": from_number,
            "message_id": message_id
        })
        
        # Extract message content
        user_message = ""
        if message_type == "text":
            user_message = message.get("text", {}).get("body", "")
        elif message_type == "audio":
            user_message = "[Audio message received - transcription pending]"
        elif message_type == "image":
            user_message = "[Image received]"
        
        if user_message:
            # Generate AI response
            ai_response = await generate_ai_response(user_message, session_id, use_grounding=True)
            
            # Send response via WhatsApp
            await whatsapp_handler.send_text_message(from_number, ai_response)
            
    except Exception as e:
        logger.error(f"Error handling WhatsApp message: {e}")


@app.post("/webhook")
async def dialogflow_webhook(request: Request):
    """Handle Dialogflow CX webhook requests"""
    try:
        body = await request.json()
        logger.info(f"Dialogflow webhook: {json.dumps(body, indent=2)}")
        
        # Extract webhook tag to determine action
        tag = body.get("fulfillmentInfo", {}).get("tag", "")
        session_id = body.get("sessionInfo", {}).get("session", "").split("/")[-1]
        
        # Extract user query
        user_query = body.get("text", "")
        if not user_query:
            transcript = body.get("transcript", "")
            user_query = transcript
        
        # Route to appropriate handler
        if tag == "init_call_session":
            response = await init_call_session(body, session_id)
        elif tag == "process_turn":
            response = await process_conversation_turn(body, session_id, user_query)
        elif tag == "handle_silence":
            response = await handle_silence(session_id)
        elif tag == "finalize_call":
            response = await finalize_call(session_id)
        else:
            # Default conversation processing
            response = await process_conversation_turn(body, session_id, user_query)
        
        return JSONResponse(response)
        
    except Exception as e:
        logger.error(f"Dialogflow webhook error: {e}")
        return JSONResponse({
            "fulfillmentResponse": {
                "messages": [{
                    "text": {
                        "text": ["Yampaye, hari ikibazo. Ongera ugerageze."]
                    }
                }]
            }
        })


async def init_call_session(body: Dict, session_id: str) -> Dict:
    """Initialize new call session"""
    logger.info(f"Initializing call session: {session_id}")
    
    # Create session in Firestore
    create_session_document(session_id, {
        "channel": "voice",
        "direction": "outbound",
        "dialogflow_session": session_id
    })
    
    # Generate opening line
    opening = await generate_ai_response(
        "Tangira guhamagara abakiriya. Wibwire kandi utangaze serivisi za EasyMo.",
        session_id
    )
    
    return {
        "fulfillmentResponse": {
            "messages": [{
                "text": {"text": [opening]}
            }]
        }
    }


async def process_conversation_turn(body: Dict, session_id: str, user_query: str) -> Dict:
    """Process conversation turn with Gemini"""
    logger.info(f"Processing turn for session {session_id}: {user_query}")
    
    # Generate AI response
    ai_response = await generate_ai_response(user_query, session_id, use_grounding=True)
    
    return {
        "fulfillmentResponse": {
            "messages": [{
                "text": {"text": [ai_response]}
            }]
        }
    }


async def handle_silence(session_id: str) -> Dict:
    """Handle user silence"""
    prompts = [
        "Uri hano?",
        "Ndakumva?",
        "Ntushaka kubaza ikibazo?",
        "Urafata umwanya, ntakintu."
    ]
    
    import random
    response = random.choice(prompts)
    
    return {
        "fulfillmentResponse": {
            "messages": [{
                "text": {"text": [response]}
            }]
        }
    }


async def finalize_call(session_id: str) -> Dict:
    """Finalize call session"""
    logger.info(f"Finalizing session: {session_id}")
    
    try:
        session_ref = db.collection("call_sessions").document(session_id)
        session_ref.update({
            "status": "completed",
            "end_time": firestore.SERVER_TIMESTAMP
        })
    except Exception as e:
        logger.error(f"Failed to finalize session: {e}")
    
    return {
        "fulfillmentResponse": {
            "messages": [{
                "text": {"text": ["Murakoze cyane! Umusi mwiza!"]}
            }]
        }
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "firestore": "connected",
            "vertex_ai": "initialized",
            "whatsapp": "configured",
            "secret_manager": "connected"
        },
        "config": {
            "project_id": PROJECT_ID,
            "location": LOCATION,
            "model": GEMINI_MODEL
        }
    }


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
