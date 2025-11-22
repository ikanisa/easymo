

import React from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
// Fix: 'auth' is not exported from App.tsx as the feature is disabled. Commenting out the import.
// import { auth } from '../App';

export const Login: React.FC = () => {
  const handleSignIn = async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      // Fix: 'auth' is not available. Commenting out the call.
      // await auth.signInWithPopup(provider);
      // The onAuthStateChanged listener in App.tsx will handle the state change and close this modal.
    } catch (error) {
      console.error("Error signing in with Google:", error);
      // You could show a notification to the user here.
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white p-8 md:p-10 rounded-2xl shadow-2xl text-center max-w-sm w-full transform transition-all animate-fade-in-up">
        <div className="flex justify-center mb-4">
           <i className="fas fa-robot text-4xl text-yellow-500"></i>
           <h1 className="text-4xl font-bold ml-2">EasyMo<span className="text-gray-700">AI</span></h1>
        </div>
        <p className="text-gray-600 mb-2">Admin Panel</p>
        <p className="text-sm text-gray-500 mb-8">Please sign in to manage your AI Sales Agents and view analytics.</p>
        <button
          onClick={handleSignIn}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center transition-transform duration-150 ease-in-out hover:scale-105 shadow-lg shadow-blue-500/20"
        >
          <i className="fab fa-google mr-3"></i>
          Sign in with Google
        </button>
        <p className="text-xs text-gray-400 mt-6">
          <i className="fas fa-lock mr-1"></i> Access is restricted to authorized personnel.
        </p>
      </div>
       <style>{`
        @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
            animation: fade-in-up 0.4s ease-out forwards;
        }
       `}</style>
    </div>
  );
};
