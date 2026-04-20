import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFriends, SearchResult } from '@/hooks/useFriends';
import { useOpenConversation, useConversations } from '@/hooks/useMessages';
import FollowButton from '@/components/poll/FollowButton';
import { useAuth } from '@/contexts/AuthContext';
import SwipeableFriendRow from '@/components/friends/SwipeableFriendRow';
import CompatibilityRing from '@/components/friends/CompatibilityRing';
import UserAvatar from '@/components/UserAvatar';
import { useIncomingDuels } from '@/hooks/useIncomingDuels';
import { 
  Search, UserPlus, UserCheck, Users, Loader2, 
  Check, X, Heart, ChevronRight, Trophy, 
  TrendingUp, TrendingDown, Minus, Sparkles, MessageCircle, Swords
} from 'lucide-react';

export default function Friends() {
  const {
    friends,
    loadingFriends,
    friendCount,
    pendingRequests,
    loadingRequests,
    suggestedFriends,
    loadingSuggested,
    searchUsers,
    sendRequest,
    sendingRequest,
    acceptRequest,
    acceptingRequest,
    rejectRequest,
    rejectingRequest,
    removeFriend,
    hasPendingRequest,
    cancelRequest,
    cancellingRequest,
    sentRequests,
  } = useFriends();

  const navigate = useNavigate();
  const openConv = useOpenConversation();
  const { data: conversations = [], totalUnread } = useConversations();
  const { user } = useAuth();
  const unreadByFriend = new Map<string, number>(
    conversations
      .filter((c) => c.unread_count > 0 && c.last_sender_id !== user?.id)
      .map((c) => [c.other_user_id, c.unread_count])
  );
  const incomingDuels = useIncomingDuels();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const openChat = async (friendId: string) => {
    try {
      const convId = await openConv.mutateAsync(friendId);
      navigate(`/messages/${convId}`);
    } catch {}
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsSearching(true);
    try {
      const results = await searchUsers(searchTerm);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const getCompatibilityColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-primary';
    if (score >= 40) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const getCompatibilityLabel = (score: number | null) => {
    if (score === null) return 'No shared votes yet';
    if (score >= 80) return 'Best Friends!';
    if (score >= 60) return 'Great Match';
    if (score >= 40) return 'Compatible';
    return 'Different Views';
  };

  const getTrendIcon = (trend: string | null) => {
    if (trend === 'up') return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="h-3 w-3 text-orange-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const getTrendLabel = (trend: string | null, change: number | null) => {
    if (!trend || trend === 'neutral' || trend === 'stable') return null;
    if (trend === 'up' && change) return `+${change}% this month`;
    if (trend === 'down' && change) return `${change}% this month`;
    return null;
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-4 animate-slide-up">
        {/* Header */}
        <div className="glass rounded-3xl p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-display font-bold leading-tight truncate">Friends</h1>
                <p className="text-xs text-muted-foreground">
                  {friendCount} friend{friendCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full gap-1 h-8 px-3 text-xs relative"
                onClick={() => navigate('/messages')}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Inbox
                {totalUnread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-1">
                    {totalUnread}
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full gap-1 h-8 px-3 text-xs"
                onClick={() => navigate('/compare')}
              >
                <Heart className="h-3.5 w-3.5" />
                Compare
              </Button>
            </div>
          </div>
        </div>

        {/* Hero action cards */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/compare/group')}
            className="relative overflow-hidden rounded-2xl p-4 text-left bg-gradient-to-br from-blue-500/90 to-indigo-600/90 active:scale-[0.98] transition-transform shadow-lg min-h-[120px] flex flex-col justify-between"
          >
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10 blur-xl" />
            <div className="relative w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="relative">
              <p className="font-bold text-white text-sm leading-tight">Crew Compare</p>
              <p className="text-[11px] text-white/80 leading-tight mt-1">
                Battle two groups or vibe-check one crew
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate('/play/duels')}
            className="relative overflow-hidden rounded-2xl p-4 text-left bg-gradient-to-br from-primary to-red-600 active:scale-[0.98] transition-transform shadow-lg min-h-[120px] flex flex-col justify-between"
          >
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10 blur-xl" />
            <div className="relative w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Swords className="h-5 w-5 text-white" />
            </div>
            <div className="relative">
              <p className="font-bold text-white text-sm leading-tight">Versa Arena</p>
              <p className="text-[11px] text-white/80 leading-tight mt-1">
                Challenge a friend to a live 10-poll duel
              </p>
            </div>
          </button>
        </div>

        <Tabs defaultValue="friends" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="friends">Friends</TabsTrigger>
            <TabsTrigger value="suggested" className="relative">
              Discover
              {suggestedFriends.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" />
              )}
            </TabsTrigger>
            <TabsTrigger value="requests" className="relative">
              Requests
              {(pendingRequests.length + sentRequests.length) > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  {pendingRequests.length + sentRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="search">Add</TabsTrigger>
          </TabsList>

          {/* Friends List */}
          <TabsContent value="friends" className="space-y-3">
            {loadingFriends ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : friends.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No friends yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Search for users to add as friends
                </p>
              </div>
            ) : (
              friends.map((friend) => (
                <SwipeableFriendRow
                  key={friend.friend_id}
                  friendName={`@${friend.friend_username || 'this friend'}`}
                  onDelete={() => removeFriend(friend.friend_id)}
                >
                  <div
                    className="glass rounded-xl p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                    onClick={() => navigate(`/friends/${friend.friend_id}`)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <UserAvatar
                        url={friend.friend_avatar_url}
                        username={friend.friend_username}
                        className="w-12 h-12"
                      />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold truncate">
                            @{friend.friend_username || 'Unknown'}
                          </h3>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Trophy className="h-3 w-3" />
                            {friend.friend_points || 0}
                          </div>
                          {incomingDuels.has(friend.friend_id) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/play/duels/${incomingDuels.get(friend.friend_id)}`);
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold animate-pulse"
                            >
                              <Swords className="h-2.5 w-2.5" />
                              Challenged you
                            </button>
                          )}
                        </div>

                        {/* Compatibility trend / label (ring shown on the right) */}
                        <div className="flex items-center gap-2 mt-1">
                          {friend.trend && friend.trend !== 'neutral' && friend.trend !== 'stable' && (
                            <div className="flex items-center gap-1">
                              {getTrendIcon(friend.trend)}
                              <span className={`text-xs ${friend.trend === 'up' ? 'text-green-500' : 'text-orange-500'}`}>
                                {getTrendLabel(friend.trend, friend.trend_change)}
                              </span>
                            </div>
                          )}

                          {(!friend.trend || friend.trend === 'neutral' || friend.trend === 'stable') && (
                            <span className="text-xs text-muted-foreground">
                              {getCompatibilityLabel(friend.compatibility_score)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Compatibility Ring */}
                      <CompatibilityRing score={friend.compatibility_score} />

                      {/* Message Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary hover:text-primary hover:bg-primary/10 relative"
                        onClick={(e) => {
                          e.stopPropagation();
                          openChat(friend.friend_id);
                        }}
                        disabled={openConv.isPending}
                      >
                        <MessageCircle className="h-4 w-4" />
                        {(unreadByFriend.get(friend.friend_id) || 0) > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center leading-none ring-2 ring-background">
                            {(unreadByFriend.get(friend.friend_id) || 0) > 9 ? '9+' : unreadByFriend.get(friend.friend_id)}
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>
                </SwipeableFriendRow>
              ))
            )}
          </TabsContent>

          {/* Suggested Friends (Similar Voters) */}
          <TabsContent value="suggested" className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">People who vote like you</h3>
            </div>
            
            {loadingSuggested ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : suggestedFriends.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No suggestions yet</h3>
                <p className="text-sm text-muted-foreground">
                  Vote on more polls to find people with similar opinions
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {suggestedFriends.map((voter) => (
                  <div key={voter.user_id} className="glass rounded-xl p-4">
                    <div className="flex items-center gap-4">
                      <UserAvatar
                        url={voter.avatar_url}
                        username={voter.username}
                        className="w-12 h-12"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">
                            @{voter.username}
                          </h3>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Trophy className="h-3 w-3" />
                            {voter.points || 0}
                          </div>
                        </div>
                        
                        {/* Similarity caption (ring shown on the right) */}
                        <p className="text-xs text-muted-foreground mt-1">
                          {voter.matching_votes}/{voter.shared_polls} shared votes match
                        </p>
                      </div>

                      <CompatibilityRing score={voter.similarity_score} />

                      <Button
                        size="sm"
                        onClick={() => sendRequest(voter.user_id)}
                        disabled={sendingRequest}
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Friend Requests */}
          <TabsContent value="requests" className="space-y-5">
            {loadingRequests ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : pendingRequests.length === 0 && sentRequests.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No pending requests</h3>
                <p className="text-sm text-muted-foreground">
                  Friend requests will appear here
                </p>
              </div>
            ) : (
              <>
                {/* Received */}
                {pendingRequests.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                      Received ({pendingRequests.length})
                    </h3>
                    {pendingRequests.map((request) => (
                      <div key={request.id} className="glass rounded-xl p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                            <span className="text-lg font-bold text-primary-foreground">
                              {request.requester_username?.[0]?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">
                              @{request.requester_username}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              Wants to be friends
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => acceptRequest(request.id)}
                              disabled={acceptingRequest}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => rejectRequest(request.id)}
                              disabled={rejectingRequest}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sent */}
                {sentRequests.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                      Sent ({sentRequests.length})
                    </h3>
                    {sentRequests.map((request: any) => (
                      <div key={request.id} className="glass rounded-xl p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                            <span className="text-lg font-bold text-primary-foreground">
                              {request.recipient_username?.[0]?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">
                              @{request.recipient_username}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              Awaiting response
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => cancelRequest(request.recipient_id)}
                            disabled={cancellingRequest}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Search & Add */}
          <TabsContent value="search" className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Search'
                )}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-3">
                {searchResults.map((user) => (
                  <div key={user.id} className="glass rounded-xl p-4">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => navigate(`/user/${user.id}`)}
                        className="flex items-center gap-4 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                      >
                        <UserAvatar
                          url={user.avatar_url}
                          username={user.username}
                          className="w-12 h-12"
                        />

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">
                            @{user.username}
                          </h3>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Trophy className="h-3 w-3" />
                            {user.points || 0} points
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-2">
                        <FollowButton creatorId={user.id} variant="icon" />
                        
                        {user.friendship_status === 'accepted' ? (
                          <Button size="sm" variant="secondary" disabled>
                            <UserCheck className="h-4 w-4 mr-1" />
                            Friends
                          </Button>
                        ) : user.friendship_status === 'pending' || hasPendingRequest(user.id) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => cancelRequest(user.id)}
                            disabled={cancellingRequest}
                          >
                            Cancel
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => sendRequest(user.id)}
                            disabled={sendingRequest}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchResults.length === 0 && searchTerm && !isSearching && (
              <div className="glass rounded-2xl p-8 text-center">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No users found</h3>
                <p className="text-sm text-muted-foreground">
                  Try a different username
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
