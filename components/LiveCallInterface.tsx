import React, { useState, useEffect, useRef } from 'react';
import { connectLiveSession, disconnectLiveSession } from '../services/gemini';

interface Props {
  onNotify: (msg: string, type: 'success' | 'info' | 'warning') => void;
}

export const LiveCallInterface: React.FC<Props> = ({ onNotify }) => {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('Ready to connect to MTN SIP Trunk...');
  const [logs, setLogs] = useState<{sender: string, text: string}[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [volume, setVolume] = useState(0);
  const [selectedVoice, setSelectedVoice] = useState('Kore');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleStart = async () => {
    setIsActive(true);
    setStatus('Initializing SIP & Live API...');
    await connectLiveSession({
      onOpen: () => {
        setStatus('Connected: EasyMo Agent Online (Kinyarwanda/English)');
        onNotify('Voice Agent Connected to Network', 'success');
      },
      onClose: () => {
        setIsActive(false);
        setStatus('Call Ended');
        onNotify('Call Session Ended', 'info');
      },
      onError: (err) => {
        console.error(err);
        setStatus(`Error: ${err.message}`);
        setIsActive(false);
        onNotify(`Connection Error: ${err.message}`, 'warning');
      },
      onMessage: (text, isUser) => {
        if (text) {
          setLogs(prev => [...prev, { sender: isUser ? 'You' : 'EasyMo Agent', text }]);
        }
      },
      onAudioData: (buffer) => {
        // Simple visualizer sim
        const data = buffer.getChannelData(0);
        let sum = 0;
        for(let i=0; i<data.length; i+=100) sum += Math.abs(data[i]);
        setVolume(Math.min(100, (sum / (data.length/100)) * 500));
      }
    }, selectedVoice);
  };

  const handleStop = async () => {
    await disconnectLiveSession();
    setIsActive(false);
    setStatus('Disconnected');
    setVolume(0);
  };

  const handleRecordSale = () => {
    onNotify('Successful Sale Conversion Recorded!', 'success');
    setLogs(prev => [...prev, { sender: 'System', text: '✅ Sale Recorded: Premium Insurance Package' }]);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-full flex flex-col relative overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800"><i className="fas fa-headset mr-2 text-blue-600"></i>Live Cold Call Agent</h2>
          <p className="text-sm text-gray-500">Real-time Voice Interaction (Gemini 2.5 Native Audio)</p>
        </div>
        <div className="flex gap-3 items-center">
            {!isActive && (
                <select 
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-gray-50 text-gray-700 outline-none focus:ring-2 focus:ring-blue-400"
                    title="Select Voice Persona"
                >
                    <option value="Kore">Kore (Male - Kinyarwanda/En)</option>
                    <option value="Zephyr">Zephyr (Female - Kinyarwanda/En)</option>
                    <option value="Fenrir">Fenrir (Male - Deep Authority)</option>
                    <option value="Puck">Puck (Male - Soft/Casual)</option>
                    <option value="Aoede">Aoede (Female - Clear Professional)</option>
                </select>
            )}
            <div className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${isActive ? 'bg-green-100 text-green-700 animate-pulse' : 'bg-gray-100 text-gray-500'}`}>
            {isActive ? 'ON AIR' : 'OFFLINE'}
            </div>
        </div>
      </div>

      <div className="flex-1 bg-gray-50 rounded-lg mb-4 p-4 overflow-y-auto scrollbar-hide border border-gray-100 relative" ref={scrollRef}>
        {logs.length === 0 && (
          <div className="text-center text-gray-400 mt-10">
            <i className="fas fa-wave-square text-4xl mb-3 opacity-20"></i>
            <p>Start the call to interact with the EasyMo Sales Agent.</p>
            <p className="text-xs mt-2">System mimics Rwandan SIP Trunk connection.</p>
          </div>
        )}
        {logs.map((log, idx) => (
          <div key={idx} className={`mb-3 ${log.sender === 'You' ? 'text-right' : log.sender === 'System' ? 'text-center' : 'text-left'}`}>
            {log.sender === 'System' ? (
                <span className="inline-block px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold border border-green-200">
                    {log.text}
                </span>
            ) : (
                <span className={`inline-block px-4 py-2 rounded-lg max-w-[80%] text-sm ${log.sender === 'You' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'}`}>
                <div className="text-xs opacity-70 mb-1 font-semibold">{log.sender}</div>
                {log.text}
                </span>
            )}
          </div>
        ))}
      </div>

      {/* Visualizer Bar */}
      <div className="h-2 bg-gray-200 rounded-full mb-4 overflow-hidden">
        <div 
            className="h-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all duration-75 ease-out"
            style={{ width: `${volume}%` }}
        ></div>
      </div>

      <div className="flex items-center justify-between bg-gray-100 p-3 rounded-lg">
        <div className="text-sm text-gray-600 font-mono truncate max-w-[200px] md:max-w-xs">
           <i className="fas fa-signal mr-2 text-xs"></i>{status}
        </div>
        <div className="flex gap-2">
            {isActive && (
                <button onClick={handleRecordSale} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm text-sm flex items-center">
                    <i className="fas fa-check mr-1"></i> Sold
                </button>
            )}
            {isActive ? (
            <button onClick={handleStop} className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-md flex items-center">
                <i className="fas fa-phone-slash mr-2"></i> End
            </button>
            ) : (
            <button onClick={handleStart} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-md flex items-center">
                <i className="fas fa-phone mr-2"></i> Call
            </button>
            )}
        </div>
      </div>
    </div>
  );
};