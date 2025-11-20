import React, { useState } from 'react';
import { findLeads } from '../services/gemini';
import ReactMarkdown from 'react-markdown';

interface Props {
  onNotify: (msg: string, type: 'success' | 'info' | 'warning') => void;
}

export const LeadGenerator: React.FC<Props> = ({ onNotify }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [grounding, setGrounding] = useState<any>(null);
  const [mode, setMode] = useState<'search' | 'maps'>('search');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setResult('');
    setGrounding(null);
    try {
      const response = await findLeads(query, mode === 'maps', mode === 'search');
      setResult(response.text || 'No textual summary provided.');
      setGrounding(response.groundingMetadata);
      onNotify('New leads successfully generated!', 'success');
    } catch (error) {
      setResult('Error fetching leads. Please try again.');
      onNotify('Failed to fetch leads', 'warning');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLeads = () => {
    if (!result) return;
    try {
      const newItem = {
        id: Date.now(),
        query,
        timestamp: new Date().toISOString(),
        content: result,
        grounding,
        mode
      };
      
      const existing = localStorage.getItem('easymo_saved_leads');
      const leads = existing ? JSON.parse(existing) : [];
      leads.unshift(newItem); // Add to beginning
      localStorage.setItem('easymo_saved_leads', JSON.stringify(leads));
      
      onNotify('Leads saved to Local Storage', 'success');
    } catch (error) {
      console.error("Failed to save leads", error);
      onNotify('Failed to save to Local Storage', 'warning');
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-full flex flex-col overflow-hidden">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center">
          <i className={`fas ${mode === 'search' ? 'fa-globe' : 'fa-map-marker-alt'} mr-2 text-amber-500`}></i>
          Rwandan Lead Finder
        </h2>
        <p className="text-sm text-gray-500">Powered by Google {mode === 'search' ? 'Search' : 'Maps'} Grounding</p>
      </div>

      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex gap-2 mb-2">
            <button type="button" onClick={() => setMode('search')} className={`flex-1 py-1 text-xs rounded font-medium border ${mode === 'search' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                Search (Web)
            </button>
            <button type="button" onClick={() => setMode('maps')} className={`flex-1 py-1 text-xs rounded font-medium border ${mode === 'maps' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                Maps (Local)
            </button>
        </div>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === 'search' ? "e.g., Insurance companies in Kigali" : "e.g., Restaurants near Nyarugenge"}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none bg-white text-gray-900"
          />
          <i className="fas fa-search absolute left-3 top-3 text-gray-400"></i>
          <button 
            type="submit" 
            disabled={loading}
            className="absolute right-1 top-1 bottom-1 bg-amber-500 hover:bg-amber-600 text-white px-4 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? <i className="fas fa-spinner fa-spin"></i> : 'Find'}
          </button>
        </div>
      </form>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {result ? (
          <div className="prose prose-sm max-w-none">
            <div className="flex justify-end mb-2">
                <button 
                    onClick={handleSaveLeads}
                    className="text-xs flex items-center bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded shadow-sm transition-all hover:shadow-md"
                    title="Save results to browser storage"
                >
                    <i className="fas fa-save mr-2 text-blue-500"></i> Save to Storage
                </button>
            </div>
            
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                <ReactMarkdown>{result}</ReactMarkdown>
            </div>
            
            {grounding?.groundingChunks && (
              <div className="mt-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Sources Found</h3>
                <ul className="space-y-2">
                  {grounding.groundingChunks.map((chunk: any, i: number) => {
                     const webUri = chunk.web?.uri;
                     const mapUri = chunk.maps?.uri;
                     const title = chunk.web?.title || chunk.maps?.title || "Source " + (i+1);
                     const uri = webUri || mapUri;

                     if (!uri) return null;

                     return (
                        <li key={i} className="flex items-center text-sm bg-gray-50 p-2 rounded border border-gray-100">
                            <i className="fas fa-external-link-alt text-xs text-blue-400 mr-2"></i>
                            <a href={uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                                {title}
                            </a>
                        </li>
                     );
                  })}
                </ul>
              </div>
            )}
          </div>
        ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <i className="fas fa-database text-4xl mb-3 opacity-20"></i>
                <p className="text-sm">Enter a query to find Rwandan contacts.</p>
            </div>
        )}
      </div>
    </div>
  );
};