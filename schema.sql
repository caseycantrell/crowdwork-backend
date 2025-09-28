--
-- PostgreSQL database dump
--

-- Dumped from database version 16.4 (Homebrew)
-- Dumped by pg_dump version 16.4 (Homebrew)

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: dancefloors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dancefloors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dj_id uuid,
    name character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) DEFAULT 'active'::character varying,
    ended_at timestamp without time zone,
    requests_count integer DEFAULT 0,
    messages_count integer DEFAULT 0
);


--
-- Name: djs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.djs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100),
    email character varying(100),
    password character varying(255),
    qr_code text,
    bio character varying(500),
    website character varying(255),
    instagram_handle character varying(255),
    twitter_handle character varying(255),
    venmo_handle character varying(255),
    cashapp_handle character varying(255),
    profile_pic_url character varying(255)
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    dancefloor_id uuid NOT NULL,
    message text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    dj_id uuid
);


--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: song_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.song_requests (
    id uuid NOT NULL,
    dancefloor_id uuid NOT NULL,
    user_id text NOT NULL,
    song text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    status character varying(20) DEFAULT 'pending'::character varying,
    "order" integer,
    likes integer DEFAULT 0,
    status_order integer DEFAULT 0 NOT NULL
);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: dancefloors dancefloors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dancefloors
    ADD CONSTRAINT dancefloors_pkey PRIMARY KEY (id);


--
-- Name: djs djs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.djs
    ADD CONSTRAINT djs_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: song_requests song_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_requests
    ADD CONSTRAINT song_requests_pkey PRIMARY KEY (id);


--
-- Name: idx_messages_dancefloor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_dancefloor_id ON public.messages USING btree (dancefloor_id);


--
-- Name: idx_song_requests_dancefloor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_song_requests_dancefloor_id ON public.song_requests USING btree (dancefloor_id);


--
-- Name: dancefloors dancefloors_dj_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dancefloors
    ADD CONSTRAINT dancefloors_dj_id_fkey FOREIGN KEY (dj_id) REFERENCES public.djs(id);


--
-- Name: messages fk_dj_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT fk_dj_id FOREIGN KEY (dj_id) REFERENCES public.djs(id) ON DELETE SET NULL;


--
-- Name: messages messages_dancefloor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_dancefloor_id_fkey FOREIGN KEY (dancefloor_id) REFERENCES public.dancefloors(id);


--
-- PostgreSQL database dump complete
--

