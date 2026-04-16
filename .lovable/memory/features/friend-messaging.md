---
name: Friend Messaging (DMs)
description: 1-on-1 IG-style chat between accepted friends with text + poll sharing, realtime delivery, unread badges
type: feature
---

## Database
- `conversations` table: 1-on-1 thread (user1_id < user2_id enforced; unique pair). RLS: only participants can SELECT/UPDATE; INSERT requires accepted friendship.
- `messages` table: `conversation_id`, `sender_id`, `content`, `message_type` ('text'|'poll_share'), `shared_poll_id` (FK polls), `read_at`. RLS via `is_conversation_participant()` security-definer.
- Trigger `handle_new_message`: bumps `last_message_at` and inserts `notifications` row with type `new_message` to recipient.
- RPC `get_or_create_conversation(_other_user_id)`: validates friendship, returns conversation id (canonical user ordering).
- RPC `get_user_conversations(p_user_id)`: returns list with last message preview/type, sender, and unread count.
- Realtime: `messages` and `conversations` added to `supabase_realtime` publication.

## UI
- `/messages` — `src/pages/Messages.tsx` conversation list with avatars, last message preview, unread badge, time.
- `/messages/:conversationId` — `src/pages/ChatThread.tsx` full-screen chat (header, scroll body, sticky composer with safe-area). Shared polls render inline as a 2-image card linking to `/poll/:id`.
- `src/hooks/useMessages.ts` — `useConversations` (with `totalUnread`), `useOpenConversation`, `useConversationMessages`, `useSendMessage`, `useMarkConversationRead`. Realtime via supabase channels invalidates react-query.
- `src/components/messages/SharePollToFriendSheet.tsx` — bottom sheet to pick a friend and send a poll into chat.
- Friends page (`/friends`): per-friend MessageCircle button opens chat, header has Inbox button with unread badge.
- `PostVoteSharePrompt` includes "Send in chat" CTA that opens the share sheet (alongside existing share-link & WhatsApp).

## Constraints
- Only accepted friends can start a conversation (enforced both in `get_or_create_conversation` and the conversations INSERT policy).
- Messages cannot be deleted/updated except marking read by recipient.
