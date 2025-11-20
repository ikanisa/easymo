"""
EasyMo Admin API - Dashboard Backend
Provides analytics and management endpoints
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from google.cloud import firestore, bigquery

# Configuration
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "easymo-478117")
DATASET_ID = "easymo_analytics"

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(title="EasyMo Admin API", version="1.0.0")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize clients
db = firestore.Client(project=PROJECT_ID)
bq_client = bigquery.Client(project=PROJECT_ID)


@app.get("/")
async def root():
    """Health check"""
    return {
        "service": "EasyMo Admin API",
        "status": "healthy",
        "version": "1.0.0"
    }


@app.get("/analytics/call_summary")
async def get_call_summary(
    days: int = Query(default=7, ge=1, le=90)
) -> Dict[str, Any]:
    """Get call summary statistics"""
    try:
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Query Firestore for call sessions
        sessions_ref = db.collection("call_sessions")
        query = sessions_ref.where("start_time", ">=", start_date)
        
        sessions = list(query.stream())
        
        # Calculate metrics
        total_calls = len(sessions)
        completed_calls = sum(1 for s in sessions if s.to_dict().get("status") == "completed")
        active_calls = sum(1 for s in sessions if s.to_dict().get("status") == "active")
        
        # Average duration (if available)
        durations = []
        for session in sessions:
            data = session.to_dict()
            if data.get("end_time") and data.get("start_time"):
                duration = (data["end_time"] - data["start_time"]).total_seconds()
                durations.append(duration)
        
        avg_duration = sum(durations) / len(durations) if durations else 0
        
        # Channel breakdown
        channels = {}
        for session in sessions:
            channel = session.to_dict().get("metadata", {}).get("channel", "unknown")
            channels[channel] = channels.get(channel, 0) + 1
        
        return {
            "period_days": days,
            "total_calls": total_calls,
            "completed_calls": completed_calls,
            "active_calls": active_calls,
            "avg_duration_seconds": round(avg_duration, 2),
            "channels": channels,
            "success_rate": round((completed_calls / total_calls * 100) if total_calls > 0 else 0, 2)
        }
        
    except Exception as e:
        logger.error(f"Failed to get call summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analytics/leads")
async def get_leads_analytics(
    days: int = Query(default=7, ge=1, le=90)
) -> Dict[str, Any]:
    """Get leads analytics"""
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Query leads
        leads_ref = db.collection("leads")
        query = leads_ref.where("created_at", ">=", start_date)
        
        leads = list(query.stream())
        
        # Metrics
        total_leads = len(leads)
        
        # Status breakdown
        statuses = {}
        for lead in leads:
            status = lead.to_dict().get("status", "unknown")
            statuses[status] = statuses.get(status, 0) + 1
        
        # Source breakdown
        sources = {}
        for lead in leads:
            source = lead.to_dict().get("source", "unknown")
            sources[source] = sources.get(source, 0) + 1
        
        # BANT score distribution
        bant_scores = [lead.to_dict().get("bant_score", 0) for lead in leads]
        avg_bant = sum(bant_scores) / len(bant_scores) if bant_scores else 0
        
        return {
            "period_days": days,
            "total_leads": total_leads,
            "statuses": statuses,
            "sources": sources,
            "avg_bant_score": round(avg_bant, 2),
            "qualified_leads": sum(1 for score in bant_scores if score >= 70)
        }
        
    except Exception as e:
        logger.error(f"Failed to get leads analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analytics/whatsapp")
async def get_whatsapp_analytics(
    days: int = Query(default=7, ge=1, le=90)
) -> Dict[str, Any]:
    """Get WhatsApp message analytics"""
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Query WhatsApp messages
        messages_ref = db.collection("whatsapp_messages")
        query = messages_ref.where("created_at", ">=", start_date)
        
        messages = list(query.stream())
        
        total_messages = len(messages)
        inbound = sum(1 for m in messages if m.to_dict().get("direction") == "inbound")
        outbound = sum(1 for m in messages if m.to_dict().get("direction") == "outbound")
        
        # Message types
        types = {}
        for msg in messages:
            msg_type = msg.to_dict().get("type", "unknown")
            types[msg_type] = types.get(msg_type, 0) + 1
        
        return {
            "period_days": days,
            "total_messages": total_messages,
            "inbound": inbound,
            "outbound": outbound,
            "message_types": types,
            "response_rate": round((outbound / inbound * 100) if inbound > 0 else 0, 2)
        }
        
    except Exception as e:
        logger.error(f"Failed to get WhatsApp analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/agents")
async def list_agents() -> List[Dict[str, Any]]:
    """List all AI agents"""
    try:
        agents_ref = db.collection("agents")
        agents = agents_ref.stream()
        
        result = []
        for agent in agents:
            data = agent.to_dict()
            result.append({
                "id": agent.id,
                "name": data.get("name"),
                "status": data.get("status"),
                "version": data.get("version"),
                "model_config": data.get("model_config"),
                "last_updated": data.get("last_updated_by")
            })
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to list agents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "firestore": "connected",
            "bigquery": "connected"
        }
    }


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
