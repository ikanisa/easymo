import axios from 'axios';

import { AgentContext,Tool } from '../../base/types';

/**
 * Google Maps Search Tool
 * Search for places using Google Maps API
 */
export const googleMapsTool: Tool = {
  name: 'google_maps_search',
  description: 'Search for places, get directions, geocoding using Google Maps',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query (e.g., "pharmacies near Kigali")' },
      location: { type: 'string', description: 'Location bias (e.g., "Kigali, Rwanda")' },
      radius: { type: 'number', description: 'Search radius in meters' }
    },
    required: ['query']
  },
  capabilities: ['search', 'location'],
  execute: async (params, context) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY not set');

    const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
      params: {
        query: params.query,
        location: params.location,
        radius: params.radius || 5000,
        key: apiKey,
        region: 'rw'
      }
    });

    return {
      results: response.data.results.map((place: any) => ({
        name: place.name,
        address: place.formatted_address,
        location: place.geometry?.location,
        rating: place.rating,
        place_id: place.place_id
      }))
    };
  }
};

/**
 * Google Places Details Tool
 * Get detailed information about a specific place
 */
export const googlePlacesTool: Tool = {
  name: 'google_places_details',
  description: 'Get detailed info about a place (phone, hours, reviews, etc.)',
  parameters: {
    type: 'object',
    properties: {
      place_id: { type: 'string', description: 'Google Place ID' }
    },
    required: ['place_id']
  },
  capabilities: ['search', 'location'],
  execute: async (params, context) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY not set');

    const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: {
        place_id: params.place_id,
        key: apiKey,
        fields: 'name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,geometry,opening_hours,types,url,reviews'
      }
    });

    return response.data.result;
  }
};

/**
 * Google Geocoding Tool
 * Convert addresses to coordinates and vice versa
 */
export const googleGeocodeTool: Tool = {
  name: 'google_geocode',
  description: 'Convert address to coordinates or coordinates to address',
  parameters: {
    type: 'object',
    properties: {
      address: { type: 'string', description: 'Address to geocode' },
      latlng: { type: 'string', description: 'Coordinates to reverse geocode (lat,lng)' }
    }
  },
  capabilities: ['location'],
  execute: async (params, context) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY not set');

    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: params.address,
        latlng: params.latlng,
        key: apiKey,
        region: 'rw'
      }
    });

    return {
      results: response.data.results.map((result: any) => ({
        formatted_address: result.formatted_address,
        location: result.geometry?.location,
        place_id: result.place_id
      }))
    };
  }
};
