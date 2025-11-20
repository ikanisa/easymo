"""
Tool Executor for EasyMo AI Agent
Handles function calling and external integrations
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

from google.cloud import firestore
import requests

logger = logging.getLogger(__name__)


class ToolExecutor:
    """Execute tools and function calls for the AI agent"""
    
    def __init__(self, db: firestore.Client):
        self.db = db
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "")
    
    async def execute_tool(self, tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool by name with given parameters"""
        try:
            if tool_name == "schedule_callback":
                return await self.schedule_callback(**parameters)
            elif tool_name == "search_inventory":
                return await self.search_inventory(**parameters)
            elif tool_name == "create_lead":
                return await self.create_lead(**parameters)
            elif tool_name == "send_brochure":
                return await self.send_brochure(**parameters)
            elif tool_name == "update_bant":
                return await self.update_bant(**parameters)
            elif tool_name == "get_pricing":
                return await self.get_pricing(**parameters)
            elif tool_name == "check_availability":
                return await self.check_availability(**parameters)
            else:
                return {
                    "success": False,
                    "error": f"Unknown tool: {tool_name}"
                }
        except Exception as e:
            logger.error(f"Tool execution error for {tool_name}: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def schedule_callback(
        self,
        phone_number: str,
        preferred_date: str,
        preferred_time: str,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Schedule a callback for the customer"""
        try:
            callback_data = {
                "phone_number": phone_number,
                "preferred_date": preferred_date,
                "preferred_time": preferred_time,
                "notes": notes or "",
                "status": "scheduled",
                "created_at": datetime.utcnow(),
                "created_by": "ai_agent"
            }
            
            # Save to Firestore
            callback_ref = self.db.collection("callbacks").document()
            callback_ref.set(callback_data)
            
            logger.info(f"Callback scheduled: {callback_ref.id}")
            
            return {
                "success": True,
                "callback_id": callback_ref.id,
                "message": f"Callback scheduled for {preferred_date} at {preferred_time}"
            }
            
        except Exception as e:
            logger.error(f"Failed to schedule callback: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def search_inventory(
        self,
        query: str,
        category: Optional[str] = None,
        location: Optional[str] = None
    ) -> Dict[str, Any]:
        """Search product/service inventory"""
        try:
            # Build Firestore query
            inventory_ref = self.db.collection("inventory")
            
            # Apply filters
            query_ref = inventory_ref
            
            if category:
                query_ref = query_ref.where("category", "==", category)
            
            if location:
                query_ref = query_ref.where("location", "==", location)
            
            # Execute query
            results = query_ref.limit(10).stream()
            
            items = []
            for doc in results:
                data = doc.to_dict()
                # Simple text matching
                if query.lower() in data.get("name", "").lower() or \
                   query.lower() in data.get("description", "").lower():
                    items.append({
                        "id": doc.id,
                        "name": data.get("name"),
                        "description": data.get("description"),
                        "price": data.get("price"),
                        "availability": data.get("availability", "In Stock")
                    })
            
            return {
                "success": True,
                "results": items,
                "count": len(items)
            }
            
        except Exception as e:
            logger.error(f"Inventory search failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "results": []
            }
    
    async def create_lead(
        self,
        customer_name: str,
        phone_number: str,
        email: Optional[str] = None,
        interest: Optional[str] = None,
        budget: Optional[str] = None,
        timeline: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a qualified lead in the system"""
        try:
            lead_data = {
                "customer_name": customer_name,
                "phone_number": phone_number,
                "email": email or "",
                "interest": interest or "",
                "budget": budget or "Unknown",
                "timeline": timeline or "Unknown",
                "notes": notes or "",
                "status": "new",
                "source": "ai_agent",
                "created_at": datetime.utcnow(),
                "bant_score": self._calculate_bant_score(budget, timeline)
            }
            
            # Save to Firestore
            lead_ref = self.db.collection("leads").document()
            lead_ref.set(lead_data)
            
            logger.info(f"Lead created: {lead_ref.id}")
            
            return {
                "success": True,
                "lead_id": lead_ref.id,
                "message": f"Lead created successfully for {customer_name}"
            }
            
        except Exception as e:
            logger.error(f"Failed to create lead: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def send_brochure(
        self,
        phone_number: str,
        brochure_type: str = "general"
    ) -> Dict[str, Any]:
        """Queue brochure to be sent via WhatsApp"""
        try:
            # Map brochure types to document URLs
            brochure_urls = {
                "general": "https://easymo.rw/brochures/general.pdf",
                "insurance": "https://easymo.rw/brochures/insurance.pdf",
                "transport": "https://easymo.rw/brochures/transport.pdf",
                "broker": "https://easymo.rw/brochures/broker.pdf"
            }
            
            brochure_url = brochure_urls.get(brochure_type, brochure_urls["general"])
            
            # Queue for sending
            brochure_data = {
                "phone_number": phone_number,
                "brochure_type": brochure_type,
                "brochure_url": brochure_url,
                "status": "pending",
                "created_at": datetime.utcnow()
            }
            
            brochure_ref = self.db.collection("brochure_queue").document()
            brochure_ref.set(brochure_data)
            
            logger.info(f"Brochure queued: {brochure_ref.id}")
            
            return {
                "success": True,
                "message": f"{brochure_type.title()} brochure will be sent to {phone_number}"
            }
            
        except Exception as e:
            logger.error(f"Failed to queue brochure: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def update_bant(
        self,
        session_id: str,
        budget: Optional[str] = None,
        authority: Optional[str] = None,
        need: Optional[str] = None,
        timing: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update BANT qualification for a session"""
        try:
            session_ref = self.db.collection("call_sessions").document(session_id)
            
            updates = {}
            if budget:
                updates["bant_qualification.budget"] = budget
            if authority:
                updates["bant_qualification.authority"] = authority
            if need:
                updates["bant_qualification.need"] = need
            if timing:
                updates["bant_qualification.timing"] = timing
            
            if updates:
                updates["updated_at"] = firestore.SERVER_TIMESTAMP
                session_ref.update(updates)
            
            return {
                "success": True,
                "message": "BANT qualification updated"
            }
            
        except Exception as e:
            logger.error(f"Failed to update BANT: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_pricing(
        self,
        service_type: str,
        plan: Optional[str] = "standard"
    ) -> Dict[str, Any]:
        """Get pricing information for services"""
        try:
            # Pricing data (could be from Firestore)
            pricing = {
                "insurance": {
                    "basic": "RWF 5,000/month",
                    "standard": "RWF 10,000/month",
                    "premium": "RWF 20,000/month"
                },
                "transport": {
                    "pay_per_ride": "RWF 200-500 per km",
                    "monthly": "RWF 50,000/month unlimited",
                    "premium": "RWF 100,000/month with priority"
                },
                "broker": {
                    "basic": "5% commission",
                    "standard": "3% commission",
                    "enterprise": "Negotiable"
                }
            }
            
            service_pricing = pricing.get(service_type, {})
            plan_price = service_pricing.get(plan, "Contact sales")
            
            return {
                "success": True,
                "service": service_type,
                "plan": plan,
                "price": plan_price,
                "all_plans": service_pricing
            }
            
        except Exception as e:
            logger.error(f"Failed to get pricing: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def check_availability(
        self,
        service_type: str,
        location: str,
        datetime_requested: Optional[str] = None
    ) -> Dict[str, Any]:
        """Check service availability"""
        try:
            # This would query real availability data
            # For now, returning mock data
            
            available = True
            message = f"{service_type.title()} is available in {location}"
            
            if datetime_requested:
                message += f" at {datetime_requested}"
            
            return {
                "success": True,
                "available": available,
                "message": message,
                "location": location,
                "service": service_type
            }
            
        except Exception as e:
            logger.error(f"Failed to check availability: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _calculate_bant_score(self, budget: Optional[str], timeline: Optional[str]) -> int:
        """Calculate BANT qualification score (0-100)"""
        score = 0
        
        # Budget scoring
        if budget and budget.lower() not in ["unknown", "none"]:
            score += 25
            if "high" in budget.lower() or any(char.isdigit() for char in budget):
                score += 15
        
        # Timeline scoring
        if timeline and timeline.lower() not in ["unknown", "none"]:
            score += 25
            if any(word in timeline.lower() for word in ["immediate", "urgent", "soon", "week", "month"]):
                score += 15
        
        # Base score for being in the system
        score += 20
        
        return min(score, 100)
    
    def get_available_tools(self) -> List[Dict[str, Any]]:
        """Get list of available tools with schemas"""
        return [
            {
                "name": "schedule_callback",
                "description": "Schedule a callback for the customer at a preferred date and time",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "phone_number": {"type": "string", "description": "Customer phone number"},
                        "preferred_date": {"type": "string", "description": "Preferred date (YYYY-MM-DD)"},
                        "preferred_time": {"type": "string", "description": "Preferred time (HH:MM)"},
                        "notes": {"type": "string", "description": "Additional notes"}
                    },
                    "required": ["phone_number", "preferred_date", "preferred_time"]
                }
            },
            {
                "name": "create_lead",
                "description": "Create a qualified lead in the CRM system",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "customer_name": {"type": "string"},
                        "phone_number": {"type": "string"},
                        "email": {"type": "string"},
                        "interest": {"type": "string", "description": "Product/service interested in"},
                        "budget": {"type": "string"},
                        "timeline": {"type": "string"},
                        "notes": {"type": "string"}
                    },
                    "required": ["customer_name", "phone_number"]
                }
            },
            {
                "name": "search_inventory",
                "description": "Search for products or services in inventory",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"},
                        "category": {"type": "string"},
                        "location": {"type": "string"}
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "send_brochure",
                "description": "Send marketing brochure via WhatsApp",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "phone_number": {"type": "string"},
                        "brochure_type": {
                            "type": "string",
                            "enum": ["general", "insurance", "transport", "broker"]
                        }
                    },
                    "required": ["phone_number"]
                }
            },
            {
                "name": "get_pricing",
                "description": "Get pricing information for services",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "service_type": {
                            "type": "string",
                            "enum": ["insurance", "transport", "broker"]
                        },
                        "plan": {"type": "string"}
                    },
                    "required": ["service_type"]
                }
            },
            {
                "name": "update_bant",
                "description": "Update BANT qualification (Budget, Authority, Need, Timing)",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "session_id": {"type": "string"},
                        "budget": {"type": "string"},
                        "authority": {"type": "string"},
                        "need": {"type": "string"},
                        "timing": {"type": "string"}
                    },
                    "required": ["session_id"]
                }
            }
        ]
