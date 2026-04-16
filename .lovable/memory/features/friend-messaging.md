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
- `/messages/:conversationId` — `src/pages/ChatThread.tsx` full-screen chat (header, scroll body, sticky composer with safe-area). Composer includes a 📊 BarChart3 button that opens `PickPollToShareSheet` to share a recently voted poll inline. Shared polls render as a 2-image card linking to `/poll/:id`.
- `src/hooks/useMessages.ts` — `useConversations` (with `totalUnread`), `useOpenConversation`, `useConversationMessages`, `useSendMessage`, `useMarkConversationRead`. Realtime via supabase channels invalidates react-query.
- `src/components/messages/SharePollToFriendSheet.tsx` — bottom sheet to pick a friend and send a poll into chat (used from PostVote, Browse, and History entry points).
- `src/components/messages/PickPollToShareSheet.tsx` — bottom sheet inside ChatThread that lists the user's 30 most recent voted polls to share into the open conversation.
- Push notifications: `handle_new_message` trigger calls `send-push-notification` edge function with `skip_in_app: true` and a deep-link URL `/messages/:conversationId`. `Notifications.tsx` maps `new_message` type to a 💬 icon.

## Share-poll-to-chat entry points
- Post-vote prompt (Hero card / `PostVoteSharePrompt`): "Send in chat" button opens `SharePollToFriendSheet`.
- Browse feed (`/browse`): primary side-action Send button (only when signed in) opens `SharePollToFriendSheet`.
- Poll history (`/history`): per-card Send icon next to ShareButton opens `SharePollToFriendSheet`.
- Inside an open chat: 📊 button next to text input opens `PickPollToShareSheet` to pick from your recent votes.

## Constraints
- Only accepted friends can start a conversation (enforced both in `get_or_create_conversation` and the conversations INSERT policy).
- Messages cannot be deleted/updated except marking read by recipient.
