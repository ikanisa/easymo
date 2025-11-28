export interface ChatSession {
  id: string;
  userId?: string;
  messages: Array<{ role: string; content: string }>;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

class SessionManager {
  private sessions = new Map<string, ChatSession>();

  create(userId?: string): ChatSession {
    const session: ChatSession = {
      id: crypto.randomUUID(),
      userId,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.sessions.set(session.id, session);
    return session;
  }

  get(sessionId: string): ChatSession | null {
    return this.sessions.get(sessionId) || null;
  }

  addMessage(
    sessionId: string,
    role: string,
    content: string
  ): ChatSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.messages.push({ role, content });
    session.updatedAt = new Date().toISOString();
    return session;
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  cleanup(maxAge: number = 3600000) {
    // Cleanup sessions older than maxAge (default 1 hour)
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      const age = now - new Date(session.updatedAt).getTime();
      if (age > maxAge) {
        this.sessions.delete(id);
      }
    }
  }
}

export const sessionManager = new SessionManager();

// Auto-cleanup every 5 minutes
setInterval(() => sessionManager.cleanup(), 300000);
