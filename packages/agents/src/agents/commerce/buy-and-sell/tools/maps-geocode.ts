/**
 * Maps Geocoding Tool
 * 
 * Convert addresses to coordinates using SerpAPI.
 */

import { childLogger } from '@easymo/commons';
import axios from 'axios';

import type { Tool } from '../../../../types/agent.types';

const log = childLogger({ service: 'agents', tool: 'maps-geocode' });

/**
 * Geocode an address to lat/lng coordinates
 */
export function mapsGeocode(): Tool {
  return {
    name: 'maps_geocode',
    description: 'Convert address or place name to coordinates (lat/lng).',
    parameters: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Address or place name to geocode' }
      },
      required: ['address']
    },
    execute: async (params, context) => {
      const { address } = params;
      const apiKey = process.env.SERPAPI_KEY;
      
      if (!apiKey) {
        log.error('SerpApi Key missing');
        throw new Error("SerpApi Key missing");
      }

      try {
        const response = await axios.get('https://serpapi.com/search', {
          params: {
            engine: 'google_maps',
            q: `${address}, Rwanda`,
            api_key: apiKey,
            type: 'search',
            hl: 'en',
            gl: 'rw'
          }
        });

        const result = response.data.local_results?.[0] || response.data.place_results;
        
        if (result?.gps_coordinates) {
          return {
            lat: result.gps_coordinates.latitude,
            lng: result.gps_coordinates.longitude,
            formatted_address: result.address || result.title
          };
        }
        
        log.warn({ address }, 'Location not found');
        return { error: "Location not found" };
      } catch (error) {
        log.error({ error: String(error), address }, 'Geocode error');
        return { error: "Geocoding failed" };
      }
    }
  };
}
