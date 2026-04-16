-- Conversations table (1-on-1)
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL,
  user2_id UUID NOT NULL,
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT user_order CHECK (user1_id < user2_id),
  CONSTRAINT unique_conversation UNIQUE (user1_id, user2_id)
);

CREATE INDEX idx_conversations_user1 ON public.conversations(user1_id, last_message_at DESC);
CREATE INDEX idx_conversations_user2 ON public.conversations(user2_id, last_message_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their conversations"
ON public.conversations FOR SELECT
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Friends can create conversations"
ON public.conversations FOR INSERT
WITH CHECK (
  (auth.uid() = user1_id OR auth.uid() = user2_id)
  AND EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = user1_id AND f.recipient_id = user2_id)
        OR (f.requester_id = user2_id AND f.recipient_id = user1_id))
  )
);

CREATE POLICY "Participants can update their conversations"
ON public.conversations FOR UPDATE
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  shared_poll_id UUID REFERENCES public.polls(id) ON DELETE SET NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_message_type CHECK (message_type IN ('text', 'poll_share'))
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_unread ON public.messages(conversation_id, sender_id) WHERE read_at IS NULL;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Security definer to check conversation participation (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conv_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = _conv_id
      AND (user1_id = _user_id OR user2_id = _user_id)
  );
$$;

CREATE POLICY "Participants can view messages"
ON public.messages FOR SELECT
USING (public.is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Participants can send messages"
ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND public.is_conversation_participant(conversation_id, auth.uid())
);

CREATE POLICY "Recipients can mark messages read"
ON public.messages FOR UPDATE
USING (
  public.is_conversation_participant(conversation_id, auth.uid())
  AND sender_id != auth.uid()
);

-- Trigger: bump conversation last_message_at + send notification
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _recipient_id uuid;
  _sender_username text;
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;

  SELECT CASE WHEN user1_id = NEW.sender_id THEN user2_id ELSE user1_id END
  INTO _recipient_id
  FROM public.conversations WHERE id = NEW.conversation_id;

  SELECT username INTO _sender_username FROM public.users WHERE id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, title, body, type, data)
  VALUES (
    _recipient_id,
    COALESCE(_sender_username, 'A friend') || ' messaged you',
    CASE
      WHEN NEW.message_type = 'poll_share' THEN '📊 Shared a poll with you'
      ELSE LEFT(COALESCE(NEW.content, ''), 80)
    END,
    'new_message',
    jsonb_build_object('conversation_id', NEW.conversation_id, 'sender_id', NEW.sender_id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.handle_new_message();

-- Get-or-create conversation helper
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _u1 uuid;
  _u2 uuid;
  _conv_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF auth.uid() = _other_user_id THEN RAISE EXCEPTION 'Cannot message yourself'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = auth.uid() AND recipient_id = _other_user_id)
        OR (requester_id = _other_user_id AND recipient_id = auth.uid()))
  ) THEN
    RAISE EXCEPTION 'You can only message friends';
  END IF;

  IF auth.uid() < _other_user_id THEN
    _u1 := auth.uid(); _u2 := _other_user_id;
  ELSE
    _u1 := _other_user_id; _u2 := auth.uid();
  END IF;

  SELECT id INTO _conv_id FROM public.conversations
  WHERE user1_id = _u1 AND user2_id = _u2;

  IF _conv_id IS NULL THEN
    INSERT INTO public.conversations (user1_id, user2_id)
    VALUES (_u1, _u2)
    RETURNING id INTO _conv_id;
  END IF;

  RETURN _conv_id;
END;
$$;

-- Get conversation list with unread counts and last message
CREATE OR REPLACE FUNCTION public.get_user_conversations(p_user_id uuid)
RETURNS TABLE (
  conversation_id uuid,
  other_user_id uuid,
  other_username text,
  last_message_at timestamp with time zone,
  last_message_preview text,
  last_message_type text,
  last_sender_id uuid,
  unread_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id != auth.uid() THEN RETURN; END IF;
  RETURN QUERY
  SELECT
    c.id,
    CASE WHEN c.user1_id = p_user_id THEN c.user2_id ELSE c.user1_id END,
    u.username,
    c.last_message_at,
    (SELECT CASE WHEN m.message_type = 'poll_share' THEN '📊 Shared a poll' ELSE LEFT(COALESCE(m.content,''), 60) END
     FROM public.messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1),
    (SELECT m.message_type FROM public.messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1),
    (SELECT m.sender_id FROM public.messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1),
    (SELECT COUNT(*) FROM public.messages m
     WHERE m.conversation_id = c.id AND m.sender_id != p_user_id AND m.read_at IS NULL)
  FROM public.conversations c
  JOIN public.users u ON u.id = CASE WHEN c.user1_id = p_user_id THEN c.user2_id ELSE c.user1_id END
  WHERE c.user1_id = p_user_id OR c.user2_id = p_user_id
  ORDER BY c.last_message_at DESC;
END;
$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;