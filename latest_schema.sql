--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8 (Debian 15.8-1.pgdg110+1)
-- Dumped by pg_dump version 15.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: tiger; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA tiger;


ALTER SCHEMA tiger OWNER TO postgres;

--
-- Name: tiger_data; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA tiger_data;


ALTER SCHEMA tiger_data OWNER TO postgres;

--
-- Name: topology; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA topology;


ALTER SCHEMA topology OWNER TO postgres;

--
-- Name: SCHEMA topology; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA topology IS 'PostGIS Topology schema';


--
-- Name: fuzzystrmatch; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA public;


--
-- Name: EXTENSION fuzzystrmatch; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION fuzzystrmatch IS 'determine similarities and distance between strings';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: postgis_tiger_geocoder; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder WITH SCHEMA tiger;


--
-- Name: EXTENSION postgis_tiger_geocoder; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis_tiger_geocoder IS 'PostGIS tiger geocoder and reverse geocoder';


--
-- Name: postgis_topology; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_topology WITH SCHEMA topology;


--
-- Name: EXTENSION postgis_topology; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis_topology IS 'PostGIS topology spatial types and functions';


--
-- PostgreSQL database dump complete
--


--
-- Name: EXTENSION vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: agent_document_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.agent_document_chunks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    embedding vector(1536),
    token_count integer,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agent_document_chunks_document_id_chunk_index_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_document_chunks
    ADD CONSTRAINT agent_document_chunks_document_id_chunk_index_key UNIQUE (document_id, chunk_index);


--
-- Name: agent_document_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_document_chunks
    ADD CONSTRAINT agent_document_chunks_pkey PRIMARY KEY (id);


--
-- Name: agent_document_chunks_document_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS agent_document_chunks_document_idx ON public.agent_document_chunks USING btree (document_id);


--
-- Name: agent_document_chunks_embedding_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS agent_document_chunks_embedding_idx ON public.agent_document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists='100');


--
-- Name: agent_document_chunks_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS agent_document_chunks_created_idx ON public.agent_document_chunks USING btree (created_at DESC);


--
-- Name: agent_document_chunks_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_document_chunks
    ADD CONSTRAINT agent_document_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.agent_documents(id) ON DELETE CASCADE;


--
-- Name: agent_document_chunks; Type: POLICY; Schema: public; Owner: -
--

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_document_chunks' AND policyname = 'agent_document_chunks_admin_manage'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'is_admin' AND n.nspname = 'public'
    ) THEN
      EXECUTE 'CREATE POLICY agent_document_chunks_admin_manage ON public.agent_document_chunks FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
    ELSE
      EXECUTE 'CREATE POLICY agent_document_chunks_admin_manage ON public.agent_document_chunks FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
    END IF;
  END IF;
END;
$$;


--
-- Name: agent_document_chunks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_document_chunks ENABLE ROW LEVEL SECURITY;


--
-- Name: agent_document_chunks_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER agent_document_chunks_updated BEFORE UPDATE ON public.agent_document_chunks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: match_agent_document_chunks; Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.match_agent_document_chunks(query_embedding vector(1536), match_count integer DEFAULT 5, agent_id uuid, min_similarity double precision DEFAULT 0)
 RETURNS TABLE(chunk_id uuid, document_id uuid, agent_id uuid, document_title text, chunk_index integer, content text, similarity double precision)
 LANGUAGE plpgsql
 STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS chunk_id,
    c.document_id,
    d.agent_id,
    d.title AS document_title,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.agent_document_chunks c
  JOIN public.agent_documents d ON d.id = c.document_id
  WHERE d.agent_id = agent_id
    AND c.embedding IS NOT NULL
    AND (1 - (c.embedding <=> query_embedding)) >= COALESCE(min_similarity, 0)
  ORDER BY c.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(COALESCE(match_count, 5), 1), 50);
END;
$$;

