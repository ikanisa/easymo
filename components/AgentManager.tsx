
import React, { useState } from 'react';
import { AgentConfig, AgentTool } from '../types';

interface Props {
  onNotify: (msg: string, type: 'success' | 'info' | 'warning') => void;
}

// Mock Data
const MOCK_AGENTS: AgentConfig[] = [
  {
    id: 'agent-001',
    name: 'AI Qualifier V1',
    status: 'ACTIVE',
    targetAudience: 'Small Business Owners (Kigali)',
    lastUpdated: '2023-10-27',
    persona: {
      systemInstruction: 'You are a professional, empathetic cold caller for EasyMo operating in the Rwandan market. You are fluent in Kinyarwanda, English, and French. PRIMARY LANGUAGE: Kinyarwanda. Most locals prefer it, so always start calls in Kinyarwanda. Only switch to English or French if the user initiates it. Your goal is to qualify leads. If the user asks if you are an AI, admit it proudly: "Yes, I\'m the EasyMo AI assistant, designed to help you faster." Never hallucinate product features. EasyMo offers: SIP Trunking integration, WhatsApp Insurance, and AI Brokerage.',
      voice: 'rw-RW-Standard-A',
      callObjective: 'Qualify lead using BANT and book appointment.',
      objectionHandling: '{"too_expensive": "We offer flexible payment plans..."}',
      qualificationSchema: '{"bant_score": 0, "qualified": false}'
    },
    modelConfig: {
      model: 'gemini-3-pro-preview',
      temperature: 0.7,
      maxTokens: 150
    },
    knowledgeBase: {
      driveFolderId: '1mU1gdPmytVyZx92u8TV9_ZqXNlFqbq60',
      active: true,
      indexedFiles: 12,
      lastSync: '2023-10-27 10:00 AM'
    },
    tools: [
      { name: 'book_appointment', description: 'Schedule a time', schema: '{}', endpoint: '/tools/book', active: true }
    ],
    stats: {
      calls24h: 142,
      connectRate: '68%',
      qualificationRate: '12%',
      avgDuration: '2m 15s'
    }
  },
  {
    id: 'agent-003',
    name: 'WhatsApp Broker',
    status: 'ACTIVE',
    targetAudience: 'General Public (Inbound)',
    lastUpdated: '2023-10-28',
    persona: {
      systemInstruction: 'You are the "EasyMo Broker", an intelligent AI assistant on WhatsApp designed to help people in Rwanda find products, services, and businesses instantly. Concisely shortlist top 3 options.',
      voice: 'N/A (Text Only)',
      callObjective: 'Shortlist businesses and connect user to merchant.',
      objectionHandling: '{}',
      qualificationSchema: '{}'
    },
    modelConfig: {
      model: 'gemini-2.5-flash-latest',
      temperature: 0.4,
      maxTokens: 512
    },
    knowledgeBase: {
      driveFolderId: '',
      active: true,
      indexedFiles: 8000,
      lastSync: 'Live Database'
    },
    tools: [
      { name: 'search_businesses', description: 'Query directory', schema: '{}', endpoint: '/tools/search', active: true }
    ],
    stats: {
      calls24h: 589, // Messages
      connectRate: '100%',
      qualificationRate: 'N/A',
      avgDuration: 'Text'
    }
  }
];

export const AgentManager: React.FC<Props> = ({ onNotify }) => {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [agents, setAgents] = useState<AgentConfig[]>(MOCK_AGENTS);
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'persona' | 'goals' | 'knowledge' | 'tools'>('persona');
  const [instructionTranslation, setInstructionTranslation] = useState('');

  const handleEdit = (agent: AgentConfig) => {
    setSelectedAgent({ ...agent }); // Deep copy would be better in prod
    setView('edit');
    setActiveTab('persona');
  };

  const handleCreate = () => {
    const newAgent: AgentConfig = {
      id: `agent-${Date.now()}`,
      name: 'New Agent',
      status: 'PAUSED',
      targetAudience: '',
      lastUpdated: new Date().toISOString().split('T')[0],
      persona: {
        systemInstruction: '',
        voice: 'rw-RW-Standard-A',
        callObjective: '',
        objectionHandling: '{}',
        qualificationSchema: '{}'
      },
      modelConfig: {
        model: 'gemini-3-pro-preview',
        temperature: 0.7,
        maxTokens: 256
      },
      knowledgeBase: {
        driveFolderId: '',
        active: false,
        indexedFiles: 0,
        lastSync: 'Never'
      },
      tools: [],
      stats: { calls24h: 0, connectRate: '0%', qualificationRate: '0%', avgDuration: '0s' }
    };
    setSelectedAgent(newAgent);
    setView('edit');
  };

  const handleSave = () => {
    if (selectedAgent) {
      setAgents(prev => {
        const idx = prev.findIndex(a => a.id === selectedAgent.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = selectedAgent;
          return updated;
        }
        return [...prev, selectedAgent];
      });
      onNotify('Agent Configuration Saved to Firestore', 'success');
      setView('list');
    }
  };

  const translateInstruction = async () => {
      onNotify('Translating to Kinyarwanda via Gemini 2.5 Flash...', 'info');
      setTimeout(() => {
          if (selectedAgent) {
              const translated = selectedAgent.persona.systemInstruction + "\n\n[KINYARWANDA TRANSLATION ATTACHED]";
              updateField('persona.systemInstruction', translated);
              onNotify('Translation Applied', 'success');
          }
      }, 1500);
  };

  const updateField = (path: string, value: any) => {
    if (!selectedAgent) return;
    const agent = { ...selectedAgent };
    
    if (path.includes('.')) {
      const [section, key] = path.split('.');
      (agent as any)[section][key] = value;
    } else {
      (agent as any)[path] = value;
    }
    setSelectedAgent(agent);
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Agent Overview</h2>
          <p className="text-gray-500">Manage your AI cold caller personas and configurations.</p>
        </div>
        <button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center shadow-sm transition-colors">
          <i className="fas fa-plus mr-2"></i> Create New Agent
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map(agent => (
          <div key={agent.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
            <div className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${agent.status === 'ACTIVE' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                        <i className={`fas ${agent.name.includes('WhatsApp') ? 'fa-comments' : 'fa-headset'} text-lg`}></i>
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{agent.name}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${agent.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {agent.status}
                        </span>
                    </div>
                </div>
                <button onClick={() => handleEdit(agent)} className="text-gray-400 hover:text-blue-600 transition-colors">
                  <i className="fas fa-cog"></i>
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                <div className="bg-gray-50 rounded p-2">
                    <div className="text-xs text-gray-500">{agent.name.includes('WhatsApp') ? 'Msgs' : 'Connects'}</div>
                    <div className="font-bold text-gray-800">{agent.stats.calls24h}</div>
                </div>
                <div className="bg-gray-50 rounded p-2">
                    <div className="text-xs text-gray-500">{agent.name.includes('WhatsApp') ? 'Success' : 'Qualified'}</div>
                    <div className="font-bold text-gray-800">{agent.stats.connectRate}</div>
                </div>
                <div className="bg-gray-50 rounded p-2">
                    <div className="text-xs text-gray-500">Docs</div>
                    <div className="font-bold text-gray-800">{agent.knowledgeBase.indexedFiles}</div>
                </div>
              </div>
              
              <div className="text-xs text-gray-500 border-t border-gray-100 pt-3 flex justify-between">
                <span><i className="fas fa-user-tag mr-1"></i> {agent.targetAudience || 'No target set'}</span>
                <span>Updated: {agent.lastUpdated}</span>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-2 border-t border-gray-200 flex justify-between items-center">
               <div className="text-xs text-gray-400 font-mono">{agent.modelConfig.model}</div>
               <button onClick={() => handleEdit(agent)} className="text-xs font-medium text-blue-600 hover:underline">Configure <i className="fas fa-arrow-right ml-1"></i></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderEditor = () => {
    if (!selectedAgent) return null;

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 border-b border-gray-200 pb-4">
          <div className="flex items-center">
            <button onClick={() => setView('list')} className="mr-4 text-gray-400 hover:text-gray-600 transition-colors">
              <i className="fas fa-arrow-left text-xl"></i>
            </button>
            <div>
                <input 
                    type="text" 
                    value={selectedAgent.name} 
                    onChange={(e) => updateField('name', e.target.value)}
                    className="text-2xl font-bold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none transition-colors w-full bg-gray-50 text-gray-900"
                />
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">ID: {selectedAgent.id}</span>
                    <select 
                        value={selectedAgent.status}
                        onChange={(e) => updateField('status', e.target.value)}
                        className={`text-xs font-bold border-none rounded px-2 py-0.5 cursor-pointer outline-none ${selectedAgent.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                    >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="PAUSED">PAUSED</option>
                        <option value="AB_TEST">A/B TEST</option>
                    </select>
                </div>
            </div>
          </div>
          <div className="flex gap-3">
             <button onClick={() => setView('list')} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
             <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center">
                <i className="fas fa-save mr-2"></i> Save Config
             </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button 
            onClick={() => setActiveTab('persona')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'persona' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <i className="fas fa-user-circle mr-2"></i> Persona
          </button>
          <button 
            onClick={() => setActiveTab('goals')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'goals' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <i className="fas fa-bullseye mr-2"></i> Goals
          </button>
          <button 
            onClick={() => setActiveTab('knowledge')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'knowledge' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <i className="fas fa-book mr-2"></i> Knowledge Base
          </button>
          <button 
            onClick={() => setActiveTab('tools')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'tools' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <i className="fas fa-tools mr-2"></i> Tools
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto pb-10">
          {activeTab === 'persona' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-bold text-gray-700">System Instruction (Persona)</label>
                        <button onClick={translateInstruction} className="text-xs text-blue-600 hover:underline"><i className="fas fa-language mr-1"></i> Translate to Kinyarwanda</button>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">Define exactly who the agent is and how it should behave. This is the "Brain".</p>
                    <textarea 
                        value={selectedAgent.persona.systemInstruction}
                        onChange={(e) => updateField('persona.systemInstruction', e.target.value)}
                        className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-sm leading-relaxed bg-white text-gray-900"
                        placeholder="You are a professional sales agent..."
                    />
                </div>
              </div>
              <div className="space-y-6">
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                    <h4 className="font-bold text-gray-800 mb-4"><i className="fas fa-sliders-h mr-2"></i>Model Config</h4>
                    
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-600 mb-1">Model Selection</label>
                        <select 
                            value={selectedAgent.modelConfig.model}
                            onChange={(e) => updateField('modelConfig.model', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"
                        >
                            <option value="gemini-3-pro-preview">Gemini 3 Pro (High Intelligence)</option>
                            <option value="gemini-2.5-flash-latest">Gemini 2.5 Flash (Fast & Versatile)</option>
                            <option value="gemini-2.5-flash-thinking-latest">Gemini 2.5 Flash Thinking (Reasoning)</option>
                            <option value="gemini-2.5-flash-lite-latest">Gemini 2.5 Flash Lite (Low Latency)</option>
                        </select>
                    </div>

                    <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-600 mb-1">Target Audience</label>
                        <input 
                            type="text"
                            value={selectedAgent.targetAudience}
                            onChange={(e) => updateField('targetAudience', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-600 mb-1">Voice Selection</label>
                        <select 
                            value={selectedAgent.persona.voice}
                            onChange={(e) => updateField('persona.voice', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"
                        >
                            <option value="rw-RW-Standard-A">rw-RW-Standard-A (Kinyarwanda Female)</option>
                            <option value="rw-RW-Standard-B">rw-RW-Standard-B (Kinyarwanda Male)</option>
                            <option value="en-US-Wavenet-D">en-US-Wavenet-D (English Male)</option>
                            <option value="fr-FR-Standard-A">fr-FR-Standard-A (French Female)</option>
                            <option value="N/A (Text Only)">N/A (Text Only)</option>
                        </select>
                    </div>

                    <div className="mb-4">
                        <div className="flex justify-between mb-1">
                            <label className="text-xs font-bold text-gray-600">Temperature</label>
                            <span className="text-xs font-mono text-blue-600">{selectedAgent.modelConfig.temperature}</span>
                        </div>
                        <input 
                            type="range" min="0" max="1" step="0.1"
                            value={selectedAgent.modelConfig.temperature}
                            onChange={(e) => updateField('modelConfig.temperature', parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                            <span>Strict</span>
                            <span>Creative</span>
                        </div>
                    </div>

                    <div className="mb-4">
                         <div className="flex justify-between mb-1">
                            <label className="text-xs font-bold text-gray-600">Max Output Tokens</label>
                            <span className="text-xs font-mono text-blue-600">{selectedAgent.modelConfig.maxTokens}</span>
                        </div>
                        <input 
                            type="range" min="64" max="2048" step="64"
                            value={selectedAgent.modelConfig.maxTokens}
                            onChange={(e) => updateField('modelConfig.maxTokens', parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'goals' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Call Objective Prompt</label>
                        <p className="text-xs text-gray-500 mb-2">What exactly is the agent trying to achieve?</p>
                        <textarea 
                            value={selectedAgent.persona.callObjective}
                            onChange={(e) => updateField('persona.callObjective', e.target.value)}
                            className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white text-gray-900"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Qualification Schema (JSON)</label>
                        <p className="text-xs text-gray-500 mb-2">Required output format for the log.</p>
                        <div className="relative">
                            <textarea 
                                value={selectedAgent.persona.qualificationSchema}
                                onChange={(e) => updateField('persona.qualificationSchema', e.target.value)}
                                className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-xs bg-gray-50 text-gray-900"
                            />
                        </div>
                    </div>
                </div>
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Objection Handling (JSON)</label>
                        <p className="text-xs text-gray-500 mb-2">Key-Value pairs for common objections.</p>
                        <textarea 
                            value={selectedAgent.persona.objectionHandling}
                            onChange={(e) => updateField('persona.objectionHandling', e.target.value)}
                            className="w-full h-full min-h-[350px] p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-xs bg-gray-50 text-gray-900"
                        />
                    </div>
                </div>
            </div>
          )}

          {activeTab === 'knowledge' && (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                        <h3 className="font-bold text-blue-800 mb-2"><i className="fab fa-google-drive mr-2"></i>Google Drive Integration</h3>
                        <p className="text-xs text-blue-600 mb-4">Connect a folder for the agent to learn from. Supports PDFs, Docs, and Sheets.</p>
                        
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-700 mb-1">Drive Folder ID</label>
                            <input 
                                type="text"
                                value={selectedAgent.knowledgeBase.driveFolderId}
                                onChange={(e) => updateField('knowledgeBase.driveFolderId', e.target.value)}
                                className="w-full p-2 border border-blue-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono bg-white text-gray-900"
                                placeholder="e.g., 1mU1gdPmyt..."
                            />
                        </div>
                        
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-bold text-gray-700">Sync Status</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${selectedAgent.knowledgeBase.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                {selectedAgent.knowledgeBase.active ? 'Active' : 'Inactive'}
                            </span>
                        </div>

                        <div className="space-y-2 text-xs text-gray-600">
                             <div className="flex justify-between">
                                <span>Indexed Files:</span>
                                <span className="font-bold">{selectedAgent.knowledgeBase.indexedFiles}</span>
                             </div>
                             <div className="flex justify-between">
                                <span>Last Sync:</span>
                                <span>{selectedAgent.knowledgeBase.lastSync}</span>
                             </div>
                        </div>

                        <div className="mt-6 flex gap-2">
                            <a 
                                href={`https://drive.google.com/drive/folders/${selectedAgent.knowledgeBase.driveFolderId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 bg-white text-blue-600 border border-blue-200 py-2 rounded text-xs font-bold text-center hover:bg-blue-50 transition-colors"
                            >
                                <i className="fas fa-external-link-alt mr-1"></i> Open Drive
                            </a>
                            <button 
                                onClick={() => onNotify('Sync triggered. Processing documents...', 'info')}
                                className="flex-1 bg-blue-600 text-white py-2 rounded text-xs font-bold hover:bg-blue-700 transition-colors"
                            >
                                <i className="fas fa-sync mr-1"></i> Sync Now
                            </button>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 h-full flex flex-col">
                    <h3 className="font-bold text-gray-800 mb-3">Internal Knowledge Viewer</h3>
                    <div className="flex-1 bg-gray-100 rounded-xl border border-gray-200 overflow-hidden relative">
                        {selectedAgent.knowledgeBase.driveFolderId ? (
                             <iframe 
                                src={`https://drive.google.com/embeddedfolderview?id=${selectedAgent.knowledgeBase.driveFolderId}#list`}
                                className="w-full h-full border-0"
                                title="Google Drive Folder View"
                             ></iframe>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <i className="fab fa-google-drive text-4xl mb-2"></i>
                                <p>Enter a Folder ID to view documents.</p>
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 text-right">
                        <i className="fas fa-lock mr-1"></i> Internal Use Only. Ensure you are logged into the authorized Google Account.
                    </p>
                </div>
             </div>
          )}

          {activeTab === 'tools' && (
            <div className="space-y-6">
                <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-gray-700">Enabled Functions</h3>
                     <button className="text-sm text-blue-600 font-medium hover:underline">+ Add Tool</button>
                </div>
                
                {selectedAgent.tools.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        <p className="text-gray-500">No tools configured. The agent cannot perform external actions.</p>
                    </div>
                ) : (
                    selectedAgent.tools.map((tool, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center">
                                    <div className="p-2 bg-blue-50 rounded-md text-blue-600 mr-3">
                                        <i className="fas fa-code"></i>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-800 font-mono">{tool.name}</h4>
                                        <p className="text-xs text-gray-500">{tool.description}</p>
                                    </div>
                                </div>
                                <div className="flex items-center">
                                    <label className="flex items-center cursor-pointer mr-4">
                                        <div className="relative">
                                        <input type="checkbox" className="sr-only" checked={tool.active} readOnly />
                                        <div className={`block w-8 h-5 rounded-full transition-colors ${tool.active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                        <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${tool.active ? 'transform translate-x-3' : ''}`}></div>
                                        </div>
                                    </label>
                                    <button className="text-gray-400 hover:text-red-500"><i className="fas fa-trash"></i></button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Endpoint</label>
                                    <input type="text" value={tool.endpoint} readOnly className="w-full text-xs p-2 bg-gray-50 rounded border border-gray-200 font-mono text-gray-900" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Schema Preview</label>
                                    <div className="w-full text-xs p-2 bg-gray-50 rounded border border-gray-200 font-mono truncate text-gray-900">{tool.schema}</div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-full overflow-hidden">
      {view === 'list' ? renderDashboard() : renderEditor()}
    </div>
  );
};
