"""
Google Maps Business Directory Indexer
Scrapes and indexes local businesses into Firestore
"""

import os
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from google.cloud import firestore
from google.cloud import secretmanager
import requests

# Configuration
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "easymo-478117")

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(title="EasyMo Business Indexer", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize clients
db = firestore.Client(project=PROJECT_ID)
secret_client = secretmanager.SecretManagerServiceClient()


def get_secret(secret_id: str) -> str:
    """Retrieve secret from Secret Manager"""
    try:
        name = f"projects/{PROJECT_ID}/secrets/{secret_id}/versions/latest"
        response = secret_client.access_secret_version(request={"name": name})
        return response.payload.data.decode('UTF-8')
    except Exception as e:
        logger.error(f"Failed to retrieve secret {secret_id}: {e}")
        return ""


# Load API key
MAPS_API_KEY = get_secret("google-maps-api-key")


@app.get("/")
async def root():
    """Health check"""
    return {
        "service": "EasyMo Business Indexer",
        "status": "healthy",
        "version": "1.0.0"
    }


@app.post("/index/search")
async def index_businesses(
    query: str = Query(..., description="Search query (e.g., 'pharmacies')"),
    location: str = Query(default="Kigali, Rwanda", description="Location to search"),
    radius: int = Query(default=5000, description="Search radius in meters")
) -> Dict[str, Any]:
    """Search and index businesses from Google Maps"""
    try:
        logger.info(f"Indexing businesses: {query} in {location}")
        
        # Use Google Places API
        businesses = await search_google_places(query, location, radius)
        
        # Index to Firestore
        indexed_count = 0
        for business in businesses:
            await index_business(business)
            indexed_count += 1
        
        return {
            "success": True,
            "query": query,
            "location": location,
            "found": len(businesses),
            "indexed": indexed_count
        }
        
    except Exception as e:
        logger.error(f"Indexing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def search_google_places(
    query: str,
    location: str,
    radius: int
) -> List[Dict[str, Any]]:
    """Search Google Places API"""
    try:
        # First, geocode the location
        geocode_url = "https://maps.googleapis.com/maps/api/geocode/json"
        geocode_params = {
            "address": location,
            "key": MAPS_API_KEY
        }
        
        geo_response = requests.get(geocode_url, params=geocode_params)
        geo_response.raise_for_status()
        geo_data = geo_response.json()
        
        if not geo_data.get("results"):
            logger.warning(f"Location not found: {location}")
            return []
        
        lat_lng = geo_data["results"][0]["geometry"]["location"]
        
        # Search nearby places
        places_url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        places_params = {
            "location": f"{lat_lng['lat']},{lat_lng['lng']}",
            "radius": radius,
            "keyword": query,
            "key": MAPS_API_KEY
        }
        
        places_response = requests.get(places_url, params=places_params)
        places_response.raise_for_status()
        places_data = places_response.json()
        
        businesses = []
        for place in places_data.get("results", []):
            # Get detailed information
            details = await get_place_details(place.get("place_id", ""))
            
            business = {
                "place_id": place.get("place_id"),
                "name": place.get("name"),
                "address": place.get("vicinity", ""),
                "location": {
                    "lat": place.get("geometry", {}).get("location", {}).get("lat"),
                    "lng": place.get("geometry", {}).get("location", {}).get("lng")
                },
                "types": place.get("types", []),
                "rating": place.get("rating"),
                "user_ratings_total": place.get("user_ratings_total"),
                "phone": details.get("phone"),
                "website": details.get("website"),
                "opening_hours": details.get("opening_hours"),
                "indexed_at": datetime.utcnow(),
                "search_query": query,
                "search_location": location
            }
            
            businesses.append(business)
        
        return businesses
        
    except Exception as e:
        logger.error(f"Google Places search failed: {e}")
        return []


async def get_place_details(place_id: str) -> Dict[str, Any]:
    """Get detailed information about a place"""
    try:
        if not place_id:
            return {}
        
        details_url = "https://maps.googleapis.com/maps/api/place/details/json"
        details_params = {
            "place_id": place_id,
            "fields": "formatted_phone_number,website,opening_hours",
            "key": MAPS_API_KEY
        }
        
        response = requests.get(details_url, params=details_params)
        response.raise_for_status()
        data = response.json()
        
        result = data.get("result", {})
        
        return {
            "phone": result.get("formatted_phone_number"),
            "website": result.get("website"),
            "opening_hours": result.get("opening_hours", {}).get("weekday_text")
        }
        
    except Exception as e:
        logger.error(f"Failed to get place details: {e}")
        return {}


async def index_business(business: Dict[str, Any]) -> None:
    """Index business to Firestore"""
    try:
        place_id = business.get("place_id")
        if not place_id:
            return
        
        # Check if already exists
        business_ref = db.collection("businesses").document(place_id)
        existing = business_ref.get()
        
        if existing.exists:
            # Update with new data
            business_ref.update({
                "updated_at": firestore.SERVER_TIMESTAMP,
                **business
            })
            logger.info(f"Updated business: {business.get('name')}")
        else:
            # Create new
            business["created_at"] = firestore.SERVER_TIMESTAMP
            business_ref.set(business)
            logger.info(f"Indexed new business: {business.get('name')}")
        
    except Exception as e:
        logger.error(f"Failed to index business: {e}")


@app.get("/businesses")
async def list_businesses(
    category: Optional[str] = None,
    location: Optional[str] = None,
    limit: int = Query(default=50, le=100)
) -> List[Dict[str, Any]]:
    """List indexed businesses"""
    try:
        businesses_ref = db.collection("businesses")
        
        query = businesses_ref.order_by("name")
        
        if category:
            query = query.where("types", "array_contains", category)
        
        if location:
            query = query.where("search_location", "==", location)
        
        results = query.limit(limit).stream()
        
        businesses = []
        for doc in results:
            data = doc.to_dict()
            businesses.append({
                "id": doc.id,
                "name": data.get("name"),
                "address": data.get("address"),
                "phone": data.get("phone"),
                "website": data.get("website"),
                "rating": data.get("rating"),
                "types": data.get("types", [])
            })
        
        return businesses
        
    except Exception as e:
        logger.error(f"Failed to list businesses: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "firestore": "connected",
            "secret_manager": "connected",
            "maps_api": "configured" if MAPS_API_KEY else "not_configured"
        }
    }


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
