
import React, { useState } from 'react';
import { LiveCallInterface } from './components/LiveCallInterface';
import { LeadGenerator } from './components/LeadGenerator';
import { SalesChat } from './components/SalesChat';
import { AudioTranscriber } from './components/AudioTranscriber';
import { Dashboard } from './components/Dashboard';
import { AgentManager } from './components/AgentManager';
import { BusinessDirectory } from './components/BusinessDirectory';
import { AgentMode, Notification } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AgentMode>(AgentMode.DASHBOARD);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (message: string, type: 'success' | 'info' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const renderContent = () => {
    switch(activeTab) {
      case AgentMode.LIVE_CALL:
        return <div className="h-[600px]"><LiveCallInterface onNotify={addNotification} /></div>;
      case AgentMode.LEAD_GEN:
        return <div className="h-[600px]"><LeadGenerator onNotify={addNotification} /></div>;
      case AgentMode.STRATEGY_CHAT:
        return <div className="h-[600px]"><SalesChat onNotify={addNotification} /></div>;
      case AgentMode.TRANSCRIPTION:
        return <div className="h-[600px]"><AudioTranscriber onNotify={addNotification} /></div>;
      case AgentMode.AGENT_MANAGER:
        return <div className="h-[650px]"><AgentManager onNotify={addNotification} /></div>;
      case AgentMode.BUSINESS_DIRECTORY:
        return <div className="h-[650px]"><BusinessDirectory onNotify={addNotification} /></div>;
      default:
        return (
            <>
                <Dashboard />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px]">
                    <LiveCallInterface onNotify={addNotification} />
                    <LeadGenerator onNotify={addNotification} />
                </div>
            </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans text-gray-800 relative overflow-hidden">
      {/* Notification Toast Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none max-w-sm w-full">
        {notifications.map(n => (
            <div key={n.id} className={`pointer-events-auto transform transition-all duration-500 ease-in-out translate-x-0 opacity-100 flex items-center p-4 rounded-lg shadow-xl border-l-4 backdrop-blur-sm ${
                n.type === 'success' ? 'bg-green-600/90 border-green-800 text-white' : 
                n.type === 'warning' ? 'bg-amber-500/90 border-amber-700 text-white' : 'bg-blue-600/90 border-blue-800 text-white'
            }`}>
                <div className="flex-shrink-0">
                    <i className={`fas ${
                        n.type === 'success' ? 'fa-check-circle' : 
                        n.type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'
                    } text-xl`}></i>
                </div>
                <div className="ml-3 font-medium text-sm">
                    {n.message}
                </div>
                <button onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))} className="ml-auto text-white/70 hover:text-white">
                    <i className="fas fa-times"></i>
                </button>
            </div>
        ))}
      </div>

      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white hidden md:flex flex-col fixed h-full z-10 shadow-xl">
        <div className="p-6 border-b border-slate-800 bg-slate-900">
            <h1 className="text-2xl font-bold tracking-tight text-yellow-400 flex items-center">
                <i className="fas fa-robot mr-2"></i>
                EasyMo<span className="text-white">AI</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1 ml-8">Rwandan Sales Agent</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <button 
                onClick={() => setActiveTab(AgentMode.DASHBOARD)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center group ${activeTab === AgentMode.DASHBOARD ? 'bg-blue-600 text-white shadow-lg translate-x-1' : 'text-slate-400 hover:bg-slate-800 hover:text-white hover:translate-x-1'}`}
            >
                <i className={`fas fa-tachometer-alt w-6 transition-transform ${activeTab === AgentMode.DASHBOARD ? 'scale-110' : 'group-hover:scale-110'}`}></i> Dashboard
            </button>
            <button 
                onClick={() => setActiveTab(AgentMode.LIVE_CALL)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center group ${activeTab === AgentMode.LIVE_CALL ? 'bg-blue-600 text-white shadow-lg translate-x-1' : 'text-slate-400 hover:bg-slate-800 hover:text-white hover:translate-x-1'}`}
            >
                <i className={`fas fa-headset w-6 transition-transform ${activeTab === AgentMode.LIVE_CALL ? 'scale-110' : 'group-hover:scale-110'}`}></i> Live Agent (Voice)
            </button>
            <button 
                onClick={() => setActiveTab(AgentMode.AGENT_MANAGER)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center group ${activeTab === AgentMode.AGENT_MANAGER ? 'bg-blue-600 text-white shadow-lg translate-x-1' : 'text-slate-400 hover:bg-slate-800 hover:text-white hover:translate-x-1'}`}
            >
                <i className={`fas fa-users-cog w-6 transition-transform ${activeTab === AgentMode.AGENT_MANAGER ? 'scale-110' : 'group-hover:scale-110'}`}></i> Agent Manager
            </button>
            <button 
                onClick={() => setActiveTab(AgentMode.BUSINESS_DIRECTORY)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center group ${activeTab === AgentMode.BUSINESS_DIRECTORY ? 'bg-blue-600 text-white shadow-lg translate-x-1' : 'text-slate-400 hover:bg-slate-800 hover:text-white hover:translate-x-1'}`}
            >
                <i className={`fas fa-store-alt w-6 transition-transform ${activeTab === AgentMode.BUSINESS_DIRECTORY ? 'scale-110' : 'group-hover:scale-110'}`}></i> Business Directory
            </button>
            <button 
                onClick={() => setActiveTab(AgentMode.LEAD_GEN)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center group ${activeTab === AgentMode.LEAD_GEN ? 'bg-blue-600 text-white shadow-lg translate-x-1' : 'text-slate-400 hover:bg-slate-800 hover:text-white hover:translate-x-1'}`}
            >
                <i className={`fas fa-search-location w-6 transition-transform ${activeTab === AgentMode.LEAD_GEN ? 'scale-110' : 'group-hover:scale-110'}`}></i> Lead Generator
            </button>
            <button 
                onClick={() => setActiveTab(AgentMode.STRATEGY_CHAT)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center group ${activeTab === AgentMode.STRATEGY_CHAT ? 'bg-blue-600 text-white shadow-lg translate-x-1' : 'text-slate-400 hover:bg-slate-800 hover:text-white hover:translate-x-1'}`}
            >
                <i className={`fas fa-comments w-6 transition-transform ${activeTab === AgentMode.STRATEGY_CHAT ? 'scale-110' : 'group-hover:scale-110'}`}></i> Chat & Strategy
            </button>
            <button 
                onClick={() => setActiveTab(AgentMode.TRANSCRIPTION)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center group ${activeTab === AgentMode.TRANSCRIPTION ? 'bg-blue-600 text-white shadow-lg translate-x-1' : 'text-slate-400 hover:bg-slate-800 hover:text-white hover:translate-x-1'}`}
            >
                <i className={`fas fa-file-audio w-6 transition-transform ${activeTab === AgentMode.TRANSCRIPTION ? 'scale-110' : 'group-hover:scale-110'}`}></i> Transcription
            </button>
        </nav>

        <div className="p-6 border-t border-slate-800 bg-slate-900">
            <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-xs font-bold shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse">MTN</div>
                <div className="ml-3">
                    <div className="text-sm font-medium">SIP Connected</div>
                    <div className="text-xs text-slate-400">Latency: 42ms</div>
                </div>
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto h-screen">
        <header className="flex justify-between items-center mb-8 md:hidden">
             <h1 className="text-xl font-bold text-gray-900">EasyMo AI</h1>
             <button className="text-gray-600" onClick={() => {}}><i className="fas fa-bars"></i></button>
        </header>

        {renderContent()}
      </main>
    </div>
  );
};

export default App;
