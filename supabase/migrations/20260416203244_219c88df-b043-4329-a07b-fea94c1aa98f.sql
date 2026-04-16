DROP FUNCTION IF EXISTS public.get_public_profiles(uuid[]);
CREATE FUNCTION public.get_public_profiles(user_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, username text, points integer, current_streak integer, longest_streak integer, created_at timestamp with time zone, avatar_url text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT u.id, u.username, u.points, u.current_streak, u.longest_streak, u.created_at, u.avatar_url
  FROM users u
  WHERE user_ids IS NULL OR u.id = ANY(user_ids);
$function$;

DROP FUNCTION IF EXISTS public.get_friends_with_scores(uuid);
CREATE FUNCTION public.get_friends_with_scores(p_user_id uuid)
 RETURNS TABLE(friend_id uuid, friend_username text, friend_points integer, compatibility_score integer, friendship_created_at timestamp with time zone, friend_avatar_url text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT u.id, u.username, u.points,
    public.get_compatibility_score(p_user_id, u.id),
    f.created_at, u.avatar_url
  FROM friendships f
  JOIN users u ON (CASE WHEN f.requester_id = p_user_id THEN u.id = f.recipient_id ELSE u.id = f.requester_id END)
  WHERE f.status = 'accepted' AND (f.requester_id = p_user_id OR f.recipient_id = p_user_id)
  ORDER BY public.get_compatibility_score(p_user_id, u.id) DESC NULLS LAST;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_friends_with_trends(uuid);
CREATE FUNCTION public.get_friends_with_trends(p_user_id uuid)
 RETURNS TABLE(friend_id uuid, friend_username text, friend_points integer, compatibility_score integer, recent_score integer, trend text, trend_change integer, friendship_created_at timestamp with time zone, friend_avatar_url text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT u.id, u.username, u.points,
    public.get_compatibility_score(p_user_id, u.id),
    (SELECT ct.recent_score FROM public.get_compatibility_trend(p_user_id, u.id) ct),
    (SELECT ct.trend FROM public.get_compatibility_trend(p_user_id, u.id) ct),
    (SELECT ct.trend_change FROM public.get_compatibility_trend(p_user_id, u.id) ct),
    f.created_at, u.avatar_url
  FROM friendships f
  JOIN users u ON (CASE WHEN f.requester_id = p_user_id THEN u.id = f.recipient_id ELSE u.id = f.requester_id END)
  WHERE f.status = 'accepted' AND (f.requester_id = p_user_id OR f.recipient_id = p_user_id)
  ORDER BY public.get_compatibility_score(p_user_id, u.id) DESC NULLS LAST;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_friend_votes(uuid, uuid);
CREATE FUNCTION public.get_friend_votes(p_user_id uuid, p_poll_id uuid)
 RETURNS TABLE(friend_id uuid, friend_username text, choice text, compatibility_score integer, friend_avatar_url text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT u.id, u.username, v.choice,
    public.get_compatibility_score(p_user_id, u.id),
    u.avatar_url
  FROM friendships f
  JOIN users u ON (CASE WHEN f.requester_id = p_user_id THEN u.id = f.recipient_id ELSE u.id = f.requester_id END)
  LEFT JOIN votes v ON v.user_id = u.id AND v.poll_id = p_poll_id
  WHERE f.status = 'accepted' AND (f.requester_id = p_user_id OR f.recipient_id = p_user_id);
END;
$function$;

DROP FUNCTION IF EXISTS public.search_users_by_username(text, uuid);
CREATE FUNCTION public.search_users_by_username(search_term text, current_user_id uuid)
 RETURNS TABLE(id uuid, username text, points integer, friendship_status text, avatar_url text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT u.id, u.username, u.points,
    COALESCE((SELECT f.status FROM friendships f
       WHERE (f.requester_id = current_user_id AND f.recipient_id = u.id)
          OR (f.recipient_id = current_user_id AND f.requester_id = u.id) LIMIT 1), 'none'),
    u.avatar_url
  FROM users u
  WHERE u.username ILIKE '%' || search_term || '%'
    AND u.id != current_user_id AND u.username IS NOT NULL
  LIMIT 20;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_similar_voters(uuid, integer);
CREATE FUNCTION public.get_similar_voters(p_user_id uuid, p_limit integer DEFAULT 10)
 RETURNS TABLE(user_id uuid, username text, points integer, shared_polls bigint, matching_votes bigint, similarity_score integer, avatar_url text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT u.id, u.username, u.points,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE v1.choice = v2.choice)::BIGINT,
    CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE v1.choice = v2.choice)::NUMERIC / COUNT(*)) * 100)::INTEGER ELSE 0 END,
    u.avatar_url
  FROM votes v1
  JOIN votes v2 ON v1.poll_id = v2.poll_id AND v1.user_id != v2.user_id
  JOIN users u ON u.id = v2.user_id
  WHERE v1.user_id = p_user_id AND u.username IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'accepted'
        AND ((f.requester_id = p_user_id AND f.recipient_id = v2.user_id)
          OR (f.recipient_id = p_user_id AND f.requester_id = v2.user_id)))
    AND NOT EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'pending'
        AND ((f.requester_id = p_user_id AND f.recipient_id = v2.user_id)
          OR (f.recipient_id = p_user_id AND f.requester_id = v2.user_id)))
  GROUP BY u.id, u.username, u.points, u.avatar_url
  HAVING COUNT(*) >= 3
  ORDER BY CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE v1.choice = v2.choice)::NUMERIC / COUNT(*)) * 100)::INTEGER ELSE 0 END DESC, COUNT(*) DESC
  LIMIT p_limit;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_leaderboard(text, integer);
CREATE FUNCTION public.get_leaderboard(order_by text DEFAULT 'points'::text, limit_count integer DEFAULT 50)
 RETURNS TABLE(id uuid, username text, points integer, current_streak integer, longest_streak integer, avatar_url text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF order_by = 'current_streak' THEN
    RETURN QUERY SELECT u.id, u.username, u.points, u.current_streak, u.longest_streak, u.avatar_url
    FROM users u ORDER BY u.current_streak DESC NULLS LAST LIMIT limit_count;
  ELSE
    RETURN QUERY SELECT u.id, u.username, u.points, u.current_streak, u.longest_streak, u.avatar_url
    FROM users u ORDER BY u.points DESC NULLS LAST LIMIT limit_count;
  END IF;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_user_conversations(uuid);
CREATE FUNCTION public.get_user_conversations(p_user_id uuid)
 RETURNS TABLE(conversation_id uuid, other_user_id uuid, other_username text, other_avatar_url text, last_message_at timestamp with time zone, last_message_preview text, last_message_type text, last_sender_id uuid, unread_count bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id != auth.uid() THEN RETURN; END IF;
  RETURN QUERY
  SELECT c.id,
    CASE WHEN c.user1_id = p_user_id THEN c.user2_id ELSE c.user1_id END,
    u.username, u.avatar_url,
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
$function$;