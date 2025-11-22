import axios from 'axios';

import { AgentContext,Tool } from '../../base/types';

/**
 * Google Custom Search Tool
 * Search the web using Google Custom Search API
 */
export const googleSearchTool: Tool = {
  name: 'google_search',
  description: 'Search the web using Google Custom Search',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      num_results: { type: 'number', description: 'Number of results (max 10)' },
      country: { type: 'string', description: 'Country code (rw for Rwanda)' }
    },
    required: ['query']
  },
  capabilities: ['search', 'web'],
  execute: async (params, context) => {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    
    if (!apiKey || !searchEngineId) {
      throw new Error('GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID must be set');
    }

    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: apiKey,
        cx: searchEngineId,
        q: params.query,
        num: params.num_results || 5,
        gl: params.country || 'rw'
      }
    });

    return {
      results: response.data.items?.map((item: any) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        displayLink: item.displayLink
      })) || []
    };
  }
};

/**
 * Google Calendar Tool
 * Schedule meetings and check availability
 */
export const googleCalendarTool: Tool = {
  name: 'google_calendar',
  description: 'Schedule meetings, check availability, manage calendar events',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create_event', 'list_events', 'check_availability'] },
      summary: { type: 'string', description: 'Event title' },
      start_time: { type: 'string', description: 'Start time (ISO 8601)' },
      end_time: { type: 'string', description: 'End time (ISO 8601)' },
      attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee emails' }
    },
    required: ['action']
  },
  capabilities: ['calendar', 'scheduling'],
  execute: async (params, context) => {
    const { google } = require('googleapis');
    const calendar = google.calendar('v3');

    // Note: This requires OAuth2 authentication setup
    // For now, returning a placeholder response
    
    if (params.action === 'create_event') {
      return {
        event_id: 'evt_' + Date.now(),
        summary: params.summary,
        start: params.start_time,
        end: params.end_time,
        status: 'created'
      };
    }

    if (params.action === 'list_events') {
      return {
        events: []
      };
    }

    return { status: 'not_implemented' };
  }
};
