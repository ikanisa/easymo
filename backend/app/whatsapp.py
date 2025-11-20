"""
WhatsApp Business API Handler for EasyMo
Handles message sending, receiving, and webhook processing
"""

import os
import json
import logging
import requests
from typing import Dict, Any, Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)


class WhatsAppHandler:
    """WhatsApp Business API Integration"""
    
    def __init__(self, phone_number_id: str, business_account_id: str, db):
        self.phone_number_id = phone_number_id
        self.business_account_id = business_account_id
        self.db = db
        self.access_token = ""
        self.api_version = "v21.0"
        self.base_url = f"https://graph.facebook.com/{self.api_version}"
        
    def _get_headers(self) -> Dict[str, str]:
        """Get API request headers"""
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
    
    async def send_text_message(self, to: str, text: str) -> Dict[str, Any]:
        """Send a text message via WhatsApp"""
        try:
            url = f"{self.base_url}/{self.phone_number_id}/messages"
            
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": to,
                "type": "text",
                "text": {
                    "preview_url": False,
                    "body": text
                }
            }
            
            response = requests.post(
                url,
                headers=self._get_headers(),
                json=payload
            )
            
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"Message sent to {to}: {result}")
            
            # Log to Firestore
            await self._log_message(to, "outbound", "text", text, result)
            
            return result
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to send WhatsApp message: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            raise
    
    async def send_template_message(
        self, 
        to: str, 
        template_name: str, 
        language_code: str = "en",
        components: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """Send a template message"""
        try:
            url = f"{self.base_url}/{self.phone_number_id}/messages"
            
            payload = {
                "messaging_product": "whatsapp",
                "to": to,
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {
                        "code": language_code
                    }
                }
            }
            
            if components:
                payload["template"]["components"] = components
            
            response = requests.post(
                url,
                headers=self._get_headers(),
                json=payload
            )
            
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"Template message sent to {to}: {result}")
            
            # Log to Firestore
            await self._log_message(to, "outbound", "template", template_name, result)
            
            return result
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to send template: {e}")
            raise
    
    async def send_media_message(
        self,
        to: str,
        media_type: str,
        media_url: str,
        caption: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send media message (image, video, audio, document)"""
        try:
            url = f"{self.base_url}/{self.phone_number_id}/messages"
            
            media_object = {
                "link": media_url
            }
            
            if caption and media_type in ["image", "video", "document"]:
                media_object["caption"] = caption
            
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": to,
                "type": media_type,
                media_type: media_object
            }
            
            response = requests.post(
                url,
                headers=self._get_headers(),
                json=payload
            )
            
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"Media message sent to {to}: {result}")
            
            # Log to Firestore
            await self._log_message(to, "outbound", media_type, media_url, result)
            
            return result
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to send media: {e}")
            raise
    
    async def send_interactive_buttons(
        self,
        to: str,
        body_text: str,
        buttons: List[Dict[str, str]],
        header_text: Optional[str] = None,
        footer_text: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send interactive button message"""
        try:
            url = f"{self.base_url}/{self.phone_number_id}/messages"
            
            interactive = {
                "type": "button",
                "body": {
                    "text": body_text
                },
                "action": {
                    "buttons": [
                        {
                            "type": "reply",
                            "reply": {
                                "id": btn["id"],
                                "title": btn["title"]
                            }
                        }
                        for btn in buttons[:3]  # Max 3 buttons
                    ]
                }
            }
            
            if header_text:
                interactive["header"] = {
                    "type": "text",
                    "text": header_text
                }
            
            if footer_text:
                interactive["footer"] = {
                    "text": footer_text
                }
            
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": to,
                "type": "interactive",
                "interactive": interactive
            }
            
            response = requests.post(
                url,
                headers=self._get_headers(),
                json=payload
            )
            
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"Interactive message sent to {to}: {result}")
            
            return result
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to send interactive message: {e}")
            raise
    
    async def send_interactive_list(
        self,
        to: str,
        body_text: str,
        button_text: str,
        sections: List[Dict],
        header_text: Optional[str] = None,
        footer_text: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send interactive list message"""
        try:
            url = f"{self.base_url}/{self.phone_number_id}/messages"
            
            interactive = {
                "type": "list",
                "body": {
                    "text": body_text
                },
                "action": {
                    "button": button_text,
                    "sections": sections
                }
            }
            
            if header_text:
                interactive["header"] = {
                    "type": "text",
                    "text": header_text
                }
            
            if footer_text:
                interactive["footer"] = {
                    "text": footer_text
                }
            
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": to,
                "type": "interactive",
                "interactive": interactive
            }
            
            response = requests.post(
                url,
                headers=self._get_headers(),
                json=payload
            )
            
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"Interactive list sent to {to}: {result}")
            
            return result
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to send interactive list: {e}")
            raise
    
    async def mark_message_read(self, message_id: str) -> Dict[str, Any]:
        """Mark a message as read"""
        try:
            url = f"{self.base_url}/{self.phone_number_id}/messages"
            
            payload = {
                "messaging_product": "whatsapp",
                "status": "read",
                "message_id": message_id
            }
            
            response = requests.post(
                url,
                headers=self._get_headers(),
                json=payload
            )
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to mark message as read: {e}")
            raise
    
    async def process_webhook(self, body: Dict[str, Any]) -> Dict[str, str]:
        """Process incoming webhook from WhatsApp"""
        try:
            logger.info(f"Processing WhatsApp webhook: {json.dumps(body, indent=2)}")
            
            # Extract entries
            if not body.get("entry"):
                return {"status": "no_entry"}
            
            for entry in body["entry"]:
                if not entry.get("changes"):
                    continue
                
                for change in entry["changes"]:
                    value = change.get("value", {})
                    
                    # Handle messages
                    if value.get("messages"):
                        for message in value["messages"]:
                            await self._process_message(message, value)
                    
                    # Handle statuses
                    if value.get("statuses"):
                        for status in value["statuses"]:
                            await self._process_status(status)
            
            return {"status": "processed"}
            
        except Exception as e:
            logger.error(f"Webhook processing error: {e}")
            return {"status": "error", "message": str(e)}
    
    async def _process_message(self, message: Dict, value: Dict):
        """Process individual message"""
        try:
            message_id = message.get("id")
            from_number = message.get("from")
            timestamp = message.get("timestamp")
            message_type = message.get("type")
            
            # Mark as read
            await self.mark_message_read(message_id)
            
            # Log to Firestore
            message_data = {
                "message_id": message_id,
                "from": from_number,
                "timestamp": datetime.fromtimestamp(int(timestamp)),
                "type": message_type,
                "direction": "inbound",
                "content": message,
                "metadata": value.get("metadata", {}),
                "created_at": datetime.utcnow()
            }
            
            self.db.collection("whatsapp_messages").document(message_id).set(message_data)
            
            logger.info(f"Message processed and logged: {message_id}")
            
        except Exception as e:
            logger.error(f"Failed to process message: {e}")
    
    async def _process_status(self, status: Dict):
        """Process message status update"""
        try:
            message_id = status.get("id")
            status_value = status.get("status")
            timestamp = status.get("timestamp")
            
            # Update message status in Firestore
            message_ref = self.db.collection("whatsapp_messages").document(message_id)
            message_ref.update({
                "status": status_value,
                "status_timestamp": datetime.fromtimestamp(int(timestamp)),
                "updated_at": datetime.utcnow()
            })
            
            logger.info(f"Message status updated: {message_id} -> {status_value}")
            
        except Exception as e:
            logger.error(f"Failed to process status: {e}")
    
    async def _log_message(
        self,
        to: str,
        direction: str,
        message_type: str,
        content: str,
        api_response: Dict
    ):
        """Log sent message to Firestore"""
        try:
            message_id = api_response.get("messages", [{}])[0].get("id", "unknown")
            
            message_data = {
                "message_id": message_id,
                "to": to,
                "direction": direction,
                "type": message_type,
                "content": content,
                "api_response": api_response,
                "status": "sent",
                "created_at": datetime.utcnow()
            }
            
            self.db.collection("whatsapp_messages").document(message_id).set(message_data)
            
            logger.info(f"Outbound message logged: {message_id}")
            
        except Exception as e:
            logger.error(f"Failed to log message: {e}")
    
    async def get_media_url(self, media_id: str) -> str:
        """Get media URL from media ID"""
        try:
            url = f"{self.base_url}/{media_id}"
            
            response = requests.get(url, headers=self._get_headers())
            response.raise_for_status()
            
            data = response.json()
            return data.get("url", "")
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get media URL: {e}")
            return ""
    
    async def download_media(self, media_url: str) -> bytes:
        """Download media content"""
        try:
            response = requests.get(
                media_url,
                headers={"Authorization": f"Bearer {self.access_token}"}
            )
            response.raise_for_status()
            
            return response.content
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to download media: {e}")
            return b""
