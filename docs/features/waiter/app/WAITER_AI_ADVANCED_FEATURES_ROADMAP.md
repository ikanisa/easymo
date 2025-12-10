# 🚀 Waiter AI - Advanced Features Implementation Roadmap

This roadmap outlines how to add world-class features to your already-complete Waiter AI PWA.

---

## 📋 Overview

**Current Status:** 95% Complete (Production Ready)  
**Time to World-Class:** 15-20 hours  
**Priority Order:** P1 → P2 → P3

---

## 🎯 Priority 1: High-Value Features (10 hours)

### 1. Voice Ordering with OpenAI Whisper (4 hours)

**Value:** Medium | **Complexity:** Medium | **Impact:** High UX improvement

#### Implementation Steps

**Step 1: Install Dependencies (5 min)**
```bash
cd waiter-pwa
pnpm add openai
```

**Step 2: Create Voice Service (30 min)**

Create `waiter-pwa/lib/voice-ordering.ts`:

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  dangerouslyAllowBrowser: false, // Use server-side only
});

export class VoiceOrderingService {
  /**
   * Transcribe audio to text using OpenAI Whisper
   */
  async transcribeAudio(audioFile: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // Auto-detect or specify

    const response = await fetch('/api/voice/transcribe', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    return data.text;
  }

  /**
   * Convert text to speech using OpenAI TTS
   */
  async generateSpeech(text: string, voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova'): Promise<Blob> {
    const response = await fetch('/api/voice/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });

    return response.blob();
  }

  /**
   * Process voice note from WhatsApp
   */
  async processWhatsAppVoiceNote(audioUrl: string): Promise<{
    transcription: string;
    confidence: number;
  }> {
    // Download audio from WhatsApp
    const audioResponse = await fetch(audioUrl);
    const audioBlob = await audioResponse.blob();
    const audioFile = new File([audioBlob], 'voice-note.ogg', { type: 'audio/ogg' });

    const transcription = await this.transcribeAudio(audioFile);

    return {
      transcription,
      confidence: 0.95, // OpenAI Whisper typically has high confidence
    };
  }
}
```

**Step 3: Create API Routes (45 min)**

Create `waiter-pwa/app/api/voice/transcribe/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: formData.get('language') as string || undefined,
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  }
}
```

Create `waiter-pwa/app/api/voice/speak/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const { text, voice } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice || 'nova',
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('TTS error:', error);
    return NextResponse.json({ error: 'TTS failed' }, { status: 500 });
  }
}
```

**Step 4: Update MessageInput Component (1 hour)**

Edit `waiter-pwa/components/chat/MessageInput.tsx`:

```typescript
'use client';

import { useState, useRef } from 'react';
import { MicrophoneIcon, PaperAirplaneIcon, StopIcon } from '@heroicons/react/24/outline';
import { useChatContext } from '@/contexts/ChatContext';

export default function MessageInput() {
  const { sendMessage, isLoading } = useChatContext();
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        
        // Transcribe audio
        const formData = new FormData();
        const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
        formData.append('file', audioFile);

        const response = await fetch('/api/voice/transcribe', {
          method: 'POST',
          body: formData,
        });

        const { text } = await response.json();
        setMessage(text);
        
        // Auto-send transcribed message
        await sendMessage(text);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    await sendMessage(message);
    setMessage('');
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t bg-white">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500"
          disabled={isLoading || isRecording}
        />
        
        {isRecording ? (
          <button
            type="button"
            onClick={stopRecording}
            className="p-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
          >
            <StopIcon className="w-6 h-6" />
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            className="p-3 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
          >
            <MicrophoneIcon className="w-6 h-6" />
          </button>
        )}

        <button
          type="submit"
          disabled={!message.trim() || isLoading}
          className="p-3 bg-primary-600 text-white rounded-full hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <PaperAirplaneIcon className="w-6 h-6" />
        </button>
      </div>
      
      {isRecording && (
        <div className="mt-2 text-center text-sm text-red-600 animate-pulse">
          🔴 Recording... Tap stop when done
        </div>
      )}
    </form>
  );
}
```

**Step 5: Update Edge Function for Voice (1 hour)**

Edit `supabase/functions/waiter-ai-agent/index.ts` to handle voice responses:

```typescript
// Add after imports
import { textToSpeech, transcribeAudio } from "../_shared/voice-handler.ts";

// In the main serve function, add voice handling
if (req.headers.get("content-type")?.includes("audio/")) {
  const audioBuffer = await req.arrayBuffer();
  const transcription = await transcribeAudio(new Uint8Array(audioBuffer));
  
  // Process transcription as text message
  body.message = transcription.text;
}

// After generating AI response, optionally convert to speech
if (req.headers.get("accept")?.includes("audio/")) {
  const audioResponse = await textToSpeech(assistantMessage);
  return new Response(audioResponse, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": audioResponse.byteLength.toString(),
    },
  });
}
```

**Step 6: Test Voice Features (45 min)**

1. Test microphone recording in browser
2. Test transcription accuracy
3. Test TTS voice quality
4. Test WhatsApp voice note handling
5. Test multi-language voice support

---

### 2. Restaurant Discovery with Google Places (3 hours)

**Value:** High | **Complexity:** Low | **Impact:** User acquisition

#### Implementation Steps

**Step 1: Get Google Places API Key (15 min)**

1. Go to https://console.cloud.google.com
2. Enable Places API
3. Create API key
4. Add to `.env.local`: `GOOGLE_PLACES_API_KEY=your-key`

**Step 2: Create Places Service (45 min)**

Create `waiter-pwa/lib/places-api.ts`:

```typescript
export interface Restaurant {
  id: string;
  name: string;
  rating: number;
  priceLevel: number;
  address: string;
  location: { lat: number; lng: number };
  photos: string[];
  openNow: boolean;
  cuisine: string[];
  distance: number; // in meters
}

export class RestaurantDiscoveryService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async findNearby(
    lat: number,
    lng: number,
    options: {
      radius?: number; // meters, default 5000
      cuisine?: string;
      minRating?: number;
      maxPrice?: number;
      openNow?: boolean;
    } = {}
  ): Promise<Restaurant[]> {
    const radius = options.radius || 5000;
    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
    
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('location', `${lat},${lng}`);
    url.searchParams.set('radius', String(radius));
    url.searchParams.set('type', 'restaurant');
    
    if (options.cuisine) {
      url.searchParams.set('keyword', options.cuisine);
    }
    
    if (options.minRating) {
      url.searchParams.set('minprice', String(options.minRating));
    }
    
    if (options.openNow) {
      url.searchParams.set('opennow', 'true');
    }

    const response = await fetch(url.toString());
    const data = await response.json();

    return data.results.map((place: any) => ({
      id: place.place_id,
      name: place.name,
      rating: place.rating || 0,
      priceLevel: place.price_level || 0,
      address: place.vicinity,
      location: place.geometry.location,
      photos: place.photos?.map((p: any) => this.getPhotoUrl(p.photo_reference)) || [],
      openNow: place.opening_hours?.open_now || false,
      cuisine: place.types?.filter((t: string) => t.includes('_food')) || [],
      distance: this.calculateDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng),
    }));
  }

  async getDetails(placeId: string): Promise<any> {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', 'name,rating,formatted_phone_number,opening_hours,website,reviews,photos,price_level');

    const response = await fetch(url.toString());
    const data = await response.json();
    return data.result;
  }

  private getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${this.apiKey}`;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }
}
```

**Step 3: Create Restaurant Search Page (1 hour)**

Create `waiter-pwa/app/[locale]/discover/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { MagnifyingGlassIcon, MapPinIcon, StarIcon } from '@heroicons/react/24/outline';
import { RestaurantDiscoveryService, Restaurant } from '@/lib/places-api';

export default function DiscoverPage() {
  const t = useTranslations();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [cuisine, setCuisine] = useState('');

  useEffect(() => {
    // Get user location
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Location error:', error);
        // Fallback to Kigali city center
        setLocation({ lat: -1.9441, lng: 30.0619 });
      }
    );
  }, []);

  const searchRestaurants = async () => {
    if (!location) return;

    setLoading(true);
    try {
      const service = new RestaurantDiscoveryService(process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY!);
      const results = await service.findNearby(location.lat, location.lng, {
        cuisine,
        openNow: true,
        minRating: 3.5,
      });
      setRestaurants(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (location) {
      searchRestaurants();
    }
  }, [location]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold mb-6">Discover Restaurants</h1>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              placeholder="Search by cuisine (e.g., Italian, Sushi, Pizza)"
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={searchRestaurants}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
            >
              <MagnifyingGlassIcon className="w-5 h-5" />
              Search
            </button>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {restaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {restaurant.photos[0] && (
        <img
          src={restaurant.photos[0]}
          alt={restaurant.name}
          className="w-full h-48 object-cover"
        />
      )}
      <div className="p-4">
        <h3 className="font-bold text-lg mb-2">{restaurant.name}</h3>
        
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center">
            <StarIcon className="w-5 h-5 text-yellow-500 fill-current" />
            <span className="ml-1 text-sm font-medium">{restaurant.rating.toFixed(1)}</span>
          </div>
          <span className="text-gray-400">•</span>
          <span className="text-sm text-gray-600">
            {'$'.repeat(restaurant.priceLevel || 2)}
          </span>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <MapPinIcon className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            {(restaurant.distance / 1000).toFixed(1)} km away
          </span>
        </div>

        <p className="text-sm text-gray-600 mb-3">{restaurant.address}</p>

        {restaurant.openNow && (
          <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full mb-3">
            Open Now
          </span>
        )}

        <button className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
          View Menu & Order
        </button>
      </div>
    </div>
  );
}
```

**Step 4: Test Restaurant Discovery (30 min)**

1. Test location detection
2. Test cuisine search
3. Test restaurant card display
4. Test "View Menu & Order" flow

---

### 3. Kitchen Display System (3 hours)

**Value:** High for restaurant staff | **Complexity:** Medium

#### Implementation Steps

**Step 1: Create Kitchen Display Page (1.5 hours)**

Create `waiter-pwa/app/kitchen/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ClockIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Order {
  id: string;
  order_number: string;
  status: 'pending' | 'preparing' | 'ready' | 'completed';
  items: OrderItem[];
  created_at: string;
  table_number?: string;
  special_instructions?: string;
  estimated_completion?: string;
}

interface OrderItem {
  id: string;
  menu_item: {
    name: string;
    category: string;
  };
  quantity: number;
  special_instructions?: string;
}

export default function KitchenDisplayPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'preparing'>('all');
  const supabase = createClient();

  useEffect(() => {
    loadOrders();

    // Subscribe to new orders
    const channel = supabase
      .channel('kitchen-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          console.log('Order change:', payload);
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const loadOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          menu_items (name, category)
        )
      `)
      .in('status', ['pending', 'preparing', 'ready'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading orders:', error);
    } else {
      setOrders(data as any);
    }
  };

  const updateStatus = async (orderId: string, status: Order['status']) => {
    const { error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (error) {
      console.error('Error updating order:', error);
    } else {
      loadOrders();
    }
  };

  const filteredOrders = orders.filter(order => 
    filter === 'all' ? true : order.status === filter
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">Kitchen Display System</h1>
          
          <div className="flex gap-2">
            {(['all', 'pending', 'preparing'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === status
                    ? 'bg-primary-600'
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                {status === 'pending' && (
                  <span className="ml-2 px-2 py-0.5 bg-red-500 rounded-full text-xs">
                    {orders.filter(o => o.status === 'pending').length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Order Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onStatusChange={updateStatus}
            />
          ))}
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-xl">No {filter === 'all' ? '' : filter} orders</p>
          </div>
        )}
      </div>
    </div>
  );
}

function OrderCard({ 
  order, 
  onStatusChange 
}: { 
  order: Order; 
  onStatusChange: (id: string, status: Order['status']) => void;
}) {
  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'bg-red-500';
      case 'preparing': return 'bg-yellow-500';
      case 'ready': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const timeSinceOrder = () => {
    const minutes = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
    return `${minutes} min ago`;
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-4 border-l-4 ${getStatusColor(order.status).replace('bg-', 'border-')}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-2xl font-bold">#{order.order_number}</div>
          {order.table_number && (
            <div className="text-sm text-gray-400">Table {order.table_number}</div>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <ClockIcon className="w-4 h-4" />
          {timeSinceOrder()}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2 mb-4">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-sm font-bold">
              {item.quantity}
            </span>
            <div className="flex-1">
              <div className="font-medium">{item.menu_item.name}</div>
              {item.special_instructions && (
                <div className="text-sm text-yellow-400 mt-1">
                  ⚠️ {item.special_instructions}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {order.special_instructions && (
        <div className="mb-4 p-2 bg-yellow-900/30 border border-yellow-700 rounded text-sm">
          <div className="font-medium text-yellow-400 mb-1">Special Instructions:</div>
          <div className="text-yellow-200">{order.special_instructions}</div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {order.status === 'pending' && (
          <button
            onClick={() => onStatusChange(order.id, 'preparing')}
            className="flex-1 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-medium transition-colors"
          >
            Start Preparing
          </button>
        )}
        
        {order.status === 'preparing' && (
          <button
            onClick={() => onStatusChange(order.id, 'ready')}
            className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <CheckIcon className="w-5 h-5" />
            Mark Ready
          </button>
        )}

        {order.status === 'ready' && (
          <button
            onClick={() => onStatusChange(order.id, 'completed')}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Complete
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Add Sound Notifications (30 min)**

Create `waiter-pwa/lib/notifications.ts`:

```typescript
export class KitchenNotificationService {
  private audio: HTMLAudioElement | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audio = new Audio('/sounds/new-order.mp3');
    }
  }

  playNewOrderSound() {
    this.audio?.play().catch(console.error);
  }

  async requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

  showNotification(title: string, options?: NotificationOptions) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        ...options,
      });
    }
  }
}
```

**Step 3: Test Kitchen Display (1 hour)**

1. Test real-time order updates
2. Test status transitions
3. Test sound notifications
4. Test on tablet/large display
5. Test multiple simultaneous orders

---

## 🎯 Priority 2: Nice-to-Have Features (8 hours)

### 4. Menu Photo Recognition (3 hours)

Create `waiter-pwa/lib/menu-vision.ts`:

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export interface ExtractedMenuItem {
  name: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  dietary_tags: string[];
}

export async function extractMenuFromPhoto(imageUrl: string): Promise<ExtractedMenuItem[]> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract all menu items from this restaurant menu photo.
            
Return a JSON array with this structure:
[
  {
    "name": "Item name",
    "description": "Brief description",
    "price": 12.50,
    "currency": "EUR",
    "category": "Appetizers/Mains/Desserts/Drinks",
    "dietary_tags": ["vegetarian", "gluten-free", etc.]
  }
]

Be accurate with prices. If no price is shown, use 0.
Include all items you can identify.`,
          },
          {
            type: 'image_url',
            image_url: { url: imageUrl },
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
  });

  const result = JSON.parse(response.choices[0].message.content || '{}');
  return result.items || [];
}
```

### 5. Smart Upselling (2 hours)

Create `waiter-pwa/lib/upsell-engine.ts`:

```typescript
import { createClient } from '@/lib/supabase/client';

export interface UpsellRecommendation {
  item: any;
  reason: string;
  confidence: number;
}

export class UpsellEngine {
  private supabase = createClient();

  async getRecommendations(cartItems: any[]): Promise<UpsellRecommendation[]> {
    const recommendations: UpsellRecommendation[] = [];

    // Rule 1: Suggest drinks with food
    const hasDrinks = cartItems.some(item => item.category === 'Drinks');
    const hasFood = cartItems.some(item => ['Appetizers', 'Mains'].includes(item.category));
    
    if (hasFood && !hasDrinks) {
      const drinks = await this.getDrinkRecommendations();
      recommendations.push({
        item: drinks[0],
        reason: 'Pairs well with your order',
        confidence: 0.9,
      });
    }

    // Rule 2: Suggest dessert
    const hasDessert = cartItems.some(item => item.category === 'Desserts');
    if (hasFood && !hasDessert && cartItems.length >= 2) {
      const desserts = await this.getDessertRecommendations();
      recommendations.push({
        item: desserts[0],
        reason: 'Complete your meal',
        confidence: 0.8,
      });
    }

    // Rule 3: Frequently bought together
    const frequentPairs = await this.getFrequentlyBoughtTogether(cartItems);
    recommendations.push(...frequentPairs);

    return recommendations;
  }

  private async getDrinkRecommendations() {
    const { data } = await this.supabase
      .from('menu_items')
      .select('*')
      .eq('category', 'Drinks')
      .eq('available', true)
      .order('popularity', { ascending: false })
      .limit(3);
    return data || [];
  }

  private async getDessertRecommendations() {
    const { data } = await this.supabase
      .from('menu_items')
      .select('*')
      .eq('category', 'Desserts')
      .eq('available', true)
      .order('rating', { ascending: false })
      .limit(3);
    return data || [];
  }

  private async getFrequentlyBoughtTogether(cartItems: any[]): Promise<UpsellRecommendation[]> {
    // Query order_items to find items frequently bought together
    const itemIds = cartItems.map(item => item.id);
    
    const { data } = await this.supabase
      .rpc('get_frequently_bought_together', { item_ids: itemIds });

    return (data || []).map((item: any) => ({
      item,
      reason: 'Frequently bought together',
      confidence: 0.7,
    }));
  }
}
```

### 6. Loyalty Program (3 hours)

**Database Migration:**

Create `supabase/migrations/20251127000000_loyalty_program.sql`:

```sql
BEGIN;

-- Loyalty points table
CREATE TABLE loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  points INTEGER DEFAULT 0 CHECK (points >= 0),
  tier TEXT CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')) DEFAULT 'bronze',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Loyalty transactions
CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  points_change INTEGER NOT NULL,
  transaction_type TEXT CHECK (transaction_type IN ('earn', 'redeem', 'expire', 'adjustment')),
  order_id UUID REFERENCES orders,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty rewards catalog
CREATE TABLE loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  points_required INTEGER NOT NULL CHECK (points_required > 0),
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_item')),
  discount_value NUMERIC,
  free_item_id UUID REFERENCES menu_items,
  active BOOLEAN DEFAULT TRUE,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reward redemptions
CREATE TABLE loyalty_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  reward_id UUID REFERENCES loyalty_rewards NOT NULL,
  order_id UUID REFERENCES orders,
  points_used INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to award points
CREATE OR REPLACE FUNCTION award_loyalty_points()
RETURNS TRIGGER AS $$
DECLARE
  points_to_award INTEGER;
  user_tier TEXT;
BEGIN
  -- Award 1 point per 1000 RWF spent (adjust as needed)
  points_to_award := FLOOR(NEW.total / 1000);

  -- Get user tier for bonus multiplier
  SELECT tier INTO user_tier
  FROM loyalty_points
  WHERE user_id = NEW.user_id;

  -- Apply tier multiplier
  CASE user_tier
    WHEN 'silver' THEN points_to_award := points_to_award * 1.5;
    WHEN 'gold' THEN points_to_award := points_to_award * 2;
    WHEN 'platinum' THEN points_to_award := points_to_award * 3;
    ELSE points_to_award := points_to_award;
  END CASE;

  -- Update user points
  INSERT INTO loyalty_points (user_id, points)
  VALUES (NEW.user_id, points_to_award)
  ON CONFLICT (user_id) DO UPDATE
  SET points = loyalty_points.points + points_to_award,
      updated_at = NOW();

  -- Log transaction
  INSERT INTO loyalty_transactions (user_id, points_change, transaction_type, order_id, description)
  VALUES (NEW.user_id, points_to_award, 'earn', NEW.id, 'Points earned from order #' || NEW.order_number);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to award points on completed orders
CREATE TRIGGER award_points_on_order
AFTER UPDATE ON orders
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
EXECUTE FUNCTION award_loyalty_points();

-- RLS policies
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own loyalty points" ON loyalty_points
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON loyalty_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view active rewards" ON loyalty_rewards
  FOR SELECT USING (active = TRUE);

CREATE POLICY "Users can view own redemptions" ON loyalty_redemptions
  FOR SELECT USING (auth.uid() = user_id);

COMMIT;
```

---

## 📊 Implementation Timeline

### Week 1: Core Advanced Features
- **Days 1-2:** Voice Ordering (4h)
- **Day 3:** Restaurant Discovery (3h)
- **Days 4-5:** Kitchen Display System (3h)

### Week 2: Enhancement Features
- **Day 1:** Menu Photo Recognition (3h)
- **Day 2:** Smart Upselling (2h)
- **Days 3-4:** Loyalty Program (3h)

### Week 3: Polish & Testing
- **Day 1-2:** Integration testing
- **Day 3:** Performance optimization
- **Day 4:** Bug fixes
- **Day 5:** Documentation

---

## ✅ Success Criteria

### Voice Ordering
- [ ] Microphone recording works in browser
- [ ] Transcription accuracy > 95%
- [ ] TTS voice quality is natural
- [ ] WhatsApp voice notes handled correctly
- [ ] Multi-language voice support

### Restaurant Discovery
- [ ] Location detection works
- [ ] Search returns relevant results
- [ ] Distance calculations accurate
- [ ] Photos display correctly
- [ ] Integration with ordering flow

### Kitchen Display System
- [ ] Real-time order updates via Realtime
- [ ] Status transitions work correctly
- [ ] Sound notifications on new orders
- [ ] Responsive on tablet displays
- [ ] Handles multiple simultaneous orders

### All Features
- [ ] Mobile responsive
- [ ] Offline capable (PWA)
- [ ] Multi-language support
- [ ] Error handling robust
- [ ] Performance metrics met

---

## 🎉 Completion

After implementing all Priority 1 & 2 features, your Waiter AI will be **world-class** with:

✅ Complete ordering system (web + WhatsApp)  
✅ Voice ordering with Whisper + TTS  
✅ Restaurant discovery with Google Places  
✅ Kitchen display system for staff  
✅ Menu photo recognition with GPT-4 Vision  
✅ Smart AI upselling  
✅ Loyalty/rewards program  

**Total Implementation Time:** 15-20 hours  
**Result:** Production-ready, world-class restaurant AI assistant

---

*Generated: 2025-11-27*
