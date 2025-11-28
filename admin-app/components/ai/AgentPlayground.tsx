"use client";

import { useState } from "react";

export function AgentPlayground() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/ai/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();
      setResponse(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">AI Agent Playground</h1>

      <form onSubmit={handleSubmit} className="mb-6">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask the AI agent anything..."
          className="w-full p-4 border rounded-lg mb-4"
          rows={4}
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
        >
          {loading ? "Processing..." : "Send"}
        </button>
      </form>

      {response && (
        <div className="border rounded-lg p-6">
          <h2 className="font-bold mb-2">Response:</h2>
          <p className="mb-4">{response.response}</p>

          {response.toolCalls && response.toolCalls.length > 0 && (
            <div className="mt-4">
              <h3 className="font-bold mb-2">Tool Calls:</h3>
              {response.toolCalls.map((call: any, i: number) => (
                <div key={i} className="bg-gray-100 p-3 rounded mb-2">
                  <div className="font-mono text-sm">
                    <div>Tool: {call.tool}</div>
                    <div>Success: {call.result.success ? "✓" : "✗"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-sm text-gray-500 mt-4">
            Iterations: {response.iterations}
          </div>
        </div>
      )}
    </div>
  );
}
