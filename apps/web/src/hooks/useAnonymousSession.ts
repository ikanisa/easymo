import { useEffect, useState } from "react";
import type { Session, User, AuthError } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";

export type WebSessionRecord = {
    id: string;
    anon_user_id: string;
    language: string;
    device_fingerprint_hash: string | null;
    last_seen_at: string;
};

type SupabaseAuthAnon = {
    signInAnonymously: () => Promise<{
        data: { session: Session | null; user: User | null };
        error: AuthError | null;
    }>;
};

export function useAnonymousSession() {
    const [sessionRow, setSessionRow] = useState<WebSessionRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let isMounted = true;
        const boot = async () => {
            try {
                const sessionResult = await supabase.auth.getSession();
                let user = sessionResult.data?.session?.user ?? null;

                if (!user) {
                    const authAnon = supabase.auth as unknown as typeof supabase.auth & SupabaseAuthAnon;
                    const { data, error } = await authAnon.signInAnonymously();
                    if (error) throw error;
                    user = data.user ?? data.session?.user ?? null;
                }

                if (!user) {
                    throw new Error("anonymous session unavailable");
                }

                const { data: existing, error: selectError } = await supabase
                    .from("web_sessions")
                    .select("*")
                    .eq("anon_user_id", user.id)
                    .limit(1)
                    .maybeSingle();

                if (selectError) throw selectError;

                if (existing && isMounted) {
                    await supabase
                        .from("web_sessions")
                        .update({ last_seen_at: new Date().toISOString() })
                        .eq("id", existing.id);
                    setSessionRow(existing as WebSessionRecord);
                } else if (isMounted) {
                    const { data: inserted, error: insertError } = await supabase
                        .from("web_sessions")
                        .insert({
                            anon_user_id: user.id,
                            language: (navigator.language ?? "en").split("-")[0],
                            device_fingerprint_hash: null,
                        })
                        .select("*")
                        .single();
                    if (insertError) throw insertError;
                    setSessionRow(inserted as WebSessionRecord);
                }
            } catch (err) {
                console.error("session initialization failed", err);
                if (isMounted) setError(err as Error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        boot();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!sessionRow) return;
        const interval = setInterval(() => {
            supabase
                .from("web_sessions")
                .update({ last_seen_at: new Date().toISOString() })
                .eq("id", sessionRow.id);
        }, 45_000);
        return () => clearInterval(interval);
    }, [sessionRow]);

    return { sessionRow, loading, error };
}
