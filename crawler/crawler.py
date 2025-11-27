import os
import time
import json
import requests
import uuid
from bs4 import BeautifulSoup
from openai import OpenAI
from supabase import create_client, Client
from dotenv import load_dotenv
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("crawler.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") # Use Service Role Key for writing
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY or not OPENAI_API_KEY:
    logger.error("Missing environment variables. Please check .env file.")
    logger.error("Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY")
    exit(1)

# Initialize clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
openai_client = OpenAI(api_key=OPENAI_API_KEY)

def fetch_html(url):
    """Fetches HTML content from a URL with a browser-like User-Agent."""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        return response.text
    except requests.RequestException as e:
        logger.error(f"Failed to fetch {url}: {e}")
        return None

def extract_text_from_html(html):
    """Extracts clean text from HTML using BeautifulSoup."""
    if not html:
        return ""
    soup = BeautifulSoup(html, 'html.parser')
    
    # Remove script and style elements
    for script in soup(["script", "style", "nav", "footer", "header"]):
        script.decompose()
        
    text = soup.get_text(separator='\n')
    
    # Break into lines and remove leading/trailing space on each
    lines = (line.strip() for line in text.splitlines())
    # Break multi-headlines into a line each
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    # Drop blank lines
    text = '\n'.join(chunk for chunk in chunks if chunk)
    
    return text[:100000] # Limit to 100k chars

def get_tenant_id():
    """Fetches the first tenant ID."""
    try:
        response = supabase.table('Tenant').select("id").limit(1).execute()
        if response.data:
            return response.data[0]['id']
    except Exception as e:
        logger.error(f"Failed to fetch tenant ID: {e}")
    return None

def process_job_source(source, tenant_id):
    logger.info(f"Processing Job Source: {source['name']} ({source['url']})")
    
    html = fetch_html(source['url'])
    if not html:
        return

    text_content = extract_text_from_html(html)
    if not text_content:
        logger.warning(f"No text extracted from {source['url']}")
        return

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": f"""You are a job extractor. Analyze the text from {source['name']} ({source['url']}) and extract the 5 most recent job listings.
                    Return a JSON array of objects with keys: title, description (brief), category, type (full_time, part_time, contract, freelance), location, salary_min (number/null), salary_max (number/null), url (absolute or relative).
                    If no jobs found, return empty array."""
                },
                {
                    "role": "user",
                    "content": f"Extract jobs from this text:\n\n{text_content}"
                }
            ],
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content
        if not content:
            return

        data = json.loads(content)
        jobs = data.get('jobs', []) or data.get('listings', [])
        
        logger.info(f"Found {len(jobs)} jobs for {source['name']}")

        for job in jobs:
            # Fix URL
            job_url = job.get('url')
            if job_url and not job_url.startswith('http'):
                from urllib.parse import urljoin
                job_url = urljoin(source['url'], job_url)

            # Insert into Supabase
            try:
                supabase.table('job_listings').insert({
                    "id": str(uuid.uuid4()),
                    "tenantId": tenant_id,
                    "title": job.get('title') or "Untitled",
                    "description": job.get('description') or "",
                    "category": job.get('category') or "General",
                    "job_type": job.get('type') or "full_time",
                    "location": job.get('location') or source.get('country_code'),
                    "pay_min": job.get('salary_min'),
                    "pay_max": job.get('salary_max'),
                    "pay_type": "annual",
                    "currency": "EUR" if source.get('country_code') == 'MT' else "RWF",
                    "status": "open",
                    "posted_by": source['name'],
                    "country_code": source.get('country_code'),
                    "created_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                    "source_id": source['id']
                }).execute()
            except Exception as e:
                logger.error(f"Failed to insert job: {e}")

    except Exception as e:
        logger.error(f"Error processing {source['name']}: {e}")

def process_property_source(source, tenant_id):
    logger.info(f"Processing Property Source: {source['source_name']} ({source['url']})")
    
    html = fetch_html(source['url'])
    if not html:
        return

    text_content = extract_text_from_html(html)
    if not text_content:
        return

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": f"""You are a real estate extractor. Analyze text from {source['source_name']} ({source['url']}) and extract 5 recent property listings.
                    Return JSON array of objects: title, description, type (rent/sale), property_type (apartment, house, villa, office, land), bedrooms (number), bathrooms (number), price (number), location, url.
                    If no listings found, return empty array."""
                },
                {
                    "role": "user",
                    "content": f"Extract properties from this text:\n\n{text_content}"
                }
            ],
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content
        if not content:
            return

        data = json.loads(content)
        properties = data.get('properties', []) or data.get('listings', [])
        
        logger.info(f"Found {len(properties)} properties for {source['source_name']}")

        for prop in properties:
            prop_url = prop.get('url')
            if prop_url and not prop_url.startswith('http'):
                from urllib.parse import urljoin
                prop_url = urljoin(source['url'], prop_url)

            try:
                supabase.table('property_listings').insert({
                    "id": str(uuid.uuid4()),
                    "tenantId": tenant_id,
                    "title": prop.get('title') or "Property Listing",
                    "description": prop.get('description') or "",
                    "type": prop.get('type') or "rent",
                    "property_type": prop.get('property_type') or "apartment",
                    "bedrooms": prop.get('bedrooms') or 1,
                    "bathrooms": prop.get('bathrooms') or 1,
                    "price": prop.get('price'),
                    "currency": "EUR" if source.get('country_code') == 'MT' else "RWF",
                    "location": {"address": prop.get('location') or source.get('country_code')},
                    "status": "available",
                    "source_url": prop_url or source['url'],
                    "created_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                    "source_id": source['id']
                }).execute()
            except Exception as e:
                logger.error(f"Failed to insert property: {e}")

    except Exception as e:
        logger.error(f"Error processing {source['source_name']}: {e}")

def run_crawler():
    logger.info("Starting crawler run...")
    
    tenant_id = get_tenant_id()
    if not tenant_id:
        logger.error("No tenant found. Cannot proceed.")
        return

    # Fetch sources
    try:
        job_sources = supabase.table('job_sources').select("*").execute().data
        property_sources = supabase.table('real_estate_sources').select("*").execute().data
    except Exception as e:
        logger.error(f"Failed to fetch sources: {e}")
        return

    # Process Job Sources
    for source in job_sources:
        process_job_source(source, tenant_id)
        time.sleep(2) # Be polite

    # Process Property Sources
    for source in property_sources:
        process_property_source(source, tenant_id)
        time.sleep(2)

    logger.info("Crawler run completed.")

if __name__ == "__main__":
    logger.info("Crawler service started. Running every 24 hours.")
    while True:
        run_crawler()
        logger.info("Sleeping for 24 hours...")
        time.sleep(86400) # 24 hours
