import React, { useState, useEffect, useRef } from 'react';
import { chatWithStrategist, chatFast, transcribeAudioFile } from '@easymo/ai';
import { arrayBufferToBase64 } from '../services/audioUtils';
import ReactMarkdown from 'react-markdown';

interface Props {
  onNotify: (msg: string, type: 'success' | 'info' | 'warning') => void;
}

export const SalesChat: React.FC<Props> = ({ onNotify }) => {
  const [messages, setMessages] = useState<{role: string, text: string, isThinking?: boolean}[]>([]);
  const [input, setInput] = useState('');
  const [isThinkingMode, setIsThinkingMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, transcribing]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMsg = { role: 'user', text: input };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setLoading(true);

    try {
      let responseText = '';
      if (isThinkingMode) {
        responseText = await chatWithStrategist(messages, newMsg.text);
      } else {
        responseText = await chatFast(messages, newMsg.text);
      }
      
      setMessages(prev => [...prev, { role: 'model', text: responseText, isThinking: isThinkingMode }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', text: "Connection error with EasyMo Brain." }]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = () => {
      onNotify('Call Reminder Scheduled for 10:00 AM tomorrow', 'info');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine supported mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setTranscribing(true);
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          const arrayBuffer = await audioBlob.arrayBuffer();
          const base64 = arrayBufferToBase64(arrayBuffer);
          
          const text = await transcribeAudioFile(base64, mimeType);
          if (text) {
             setInput(prev => prev + (prev ? ' ' : '') + text);
             onNotify('Audio transcribed successfully', 'success');
          } else {
             onNotify('No speech detected', 'info');
          }
        } catch (error) {
          console.error("Transcription error:", error);
          onNotify('Voice transcription failed', 'warning');
        } finally {
          setTranscribing(false);
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      onNotify('Listening...', 'info');
    } catch (err) {
      console.error("Error accessing microphone:", err);
      onNotify("Could not access microphone", "warning");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <i className="fas fa-comments mr-2 text-purple-500"></i>
            Sales Broker Chat
          </h2>
          <p className="text-sm text-gray-500">
            {isThinkingMode ? 'Using Gemini 3 Pro (Reasoning)' : 'Using Gemini 2.5 Flash Lite (Fast)'}
          </p>
        </div>
        <div className="flex items-center gap-4">
            <button onClick={handleSchedule} title="Schedule Reminder" className="text-gray-400 hover:text-blue-500 transition-colors">
                <i className="fas fa-bell"></i>
            </button>
            <label className="flex items-center cursor-pointer">
                <div className="mr-2 text-xs font-bold text-gray-600">Thinking Mode</div>
                <div className="relative">
                <input type="checkbox" className="sr-only" checked={isThinkingMode} onChange={() => setIsThinkingMode(!isThinkingMode)} />
                <div className={`block w-10 h-6 rounded-full transition-colors ${isThinkingMode ? 'bg-purple-600' : 'bg-gray-300'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isThinkingMode ? 'transform translate-x-4' : ''}`}></div>
                </div>
            </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 pr-2" ref={scrollRef}>
        {messages.length === 0 && (
             <div className="text-center text-gray-400 mt-10">
                <i className="fas fa-robot text-4xl mb-3 opacity-20"></i>
                <p className="text-sm">Chat with the EasyMo Broker.</p>
                <p className="text-xs mt-1">Use Thinking Mode for complex negotiations.</p>
            </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}>
              {msg.isThinking && msg.role === 'model' && (
                <div className="text-xs text-purple-500 mb-1 font-mono border-b border-purple-200 pb-1">
                    <i className="fas fa-brain mr-1"></i> Thought Process Active
                </div>
              )}
              <ReactMarkdown>{msg.text}</ReactMarkdown>
            </div>
          </div>
        ))}
        {loading && (
            <div className="flex justify-start mb-4">
                <div className="bg-gray-100 p-3 rounded-lg rounded-bl-none text-gray-500 text-sm flex items-center">
                    <i className="fas fa-circle-notch fa-spin mr-2"></i>
                    {isThinkingMode ? 'Reasoning...' : 'Typing...'}
                </div>
            </div>
        )}
        {transcribing && (
            <div className="flex justify-end mb-4">
                <div className="bg-blue-50 p-2 rounded-lg text-blue-600 text-xs flex items-center">
                    <i className="fas fa-wave-square animate-pulse mr-2"></i>
                    Transcribing audio...
                </div>
            </div>
        )}
      </div>

      <form onSubmit={handleSend} className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isRecording ? "Listening..." : "Type message..."}
          disabled={isRecording || transcribing}
          className={`w-full pl-4 pr-24 py-3 border rounded-lg focus:ring-2 focus:border-transparent outline-none transition-colors ${isRecording ? 'border-red-300 bg-red-50 text-red-900 focus:ring-red-200' : 'border-gray-300 bg-white text-gray-900 focus:ring-purple-500'}`}
        />
        
        <div className="absolute right-2 top-2 bottom-2 flex gap-1">
            <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={loading || transcribing}
                className={`px-3 rounded-md transition-all flex items-center justify-center ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                title="Record Voice Input"
            >
                <i className={`fas ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
            </button>
            
            <button 
                type="submit" 
                disabled={loading || transcribing || !input.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 rounded-md transition-colors disabled:opacity-50 disabled:bg-gray-300"
            >
              <i className="fas fa-paper-plane"></i>
            </button>
        </div>
      </form>
    </div>
  );
};