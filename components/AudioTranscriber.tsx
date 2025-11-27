import React, { useState } from 'react';
import { transcribeAudioFile } from '@easymo/ai';

interface Props {
  onNotify: (msg: string, type: 'success' | 'info' | 'warning') => void;
}

export const AudioTranscriber: React.FC<Props> = ({ onNotify }) => {
  const [transcription, setTranscription] = useState('');
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setLoading(true);
    setTranscription('');

    const reader = new FileReader();
    reader.onload = async (event) => {
        const base64String = (event.target?.result as string).split(',')[1];
        try {
            const text = await transcribeAudioFile(base64String, file.type);
            setTranscription(text);
            onNotify('Transcription completed successfully', 'success');
        } catch (err) {
            setTranscription("Error processing audio file.");
            onNotify('Transcription failed', 'warning');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <i className="fas fa-file-audio mr-2 text-teal-500"></i>
        Call Transcription
      </h2>
      
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors mb-4 cursor-pointer relative">
        <input 
            type="file" 
            accept="audio/*" 
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <i className="fas fa-cloud-upload-alt text-3xl text-gray-400 mb-2"></i>
        <p className="text-sm text-gray-600 font-medium">
            {loading ? 'Uploading & Transcribing...' : fileName || 'Click to upload call recording'}
        </p>
        <p className="text-xs text-gray-400 mt-1">Supports MP3, WAV, AAC</p>
      </div>

      <div className="flex-1 bg-gray-50 rounded-lg p-4 border border-gray-200 overflow-y-auto">
        {loading ? (
             <div className="flex items-center justify-center h-full text-gray-500">
                <i className="fas fa-spinner fa-spin mr-2"></i> Transcribing audio...
             </div>
        ) : transcription ? (
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{transcription}</p>
        ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                No transcription generated yet.
            </div>
        )}
      </div>
    </div>
  );
};