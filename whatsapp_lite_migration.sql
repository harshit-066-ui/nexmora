-- =============================================
-- NEXMORA FINAL CLEAN SCHEMA (ONLY VERSION)
-- =============================================

-- 1. TABLES
CREATE TABLE IF NOT EXISTS public.chat_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    avatar_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    is_group BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES public.chat_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.chat_profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.chat_profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'sent',
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. RLS
ALTER TABLE public.chat_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 3. RLS POLICIES
DO $$ BEGIN
  CREATE POLICY "profiles_select"
  ON public.chat_profiles
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "rooms_select"
  ON public.chat_rooms
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "participants_select"
  ON public.chat_participants
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "messages_select"
  ON public.chat_messages
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_participants_chat ON public.chat_participants(chat_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON public.chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON public.chat_messages(chat_id);