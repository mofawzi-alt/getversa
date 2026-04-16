import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFriends, SearchResult } from '@/hooks/useFriends';
import { useOpenConversation, useConversations } from '@/hooks/useMessages';
import FollowButton from '@/components/poll/FollowButton';
import { 
  Search, UserPlus, UserCheck, Users, Loader2, 
  Check, X, Heart, ChevronRight, Trophy, 
  TrendingUp, TrendingDown, Minus, Sparkles, MessageCircle
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
      <div className="p-4 space-y-6 animate-slide-up">
        {/* Header */}
        <div className="glass rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold">Friends</h1>
                <p className="text-sm text-muted-foreground">
                  {friendCount} friend{friendCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full gap-1.5 relative"
                onClick={() => navigate('/messages')}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Inbox
                {totalUnread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                    {totalUnread}
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full gap-1.5"
                onClick={() => navigate('/compare')}
              >
                <Heart className="h-3.5 w-3.5" />
                Compare
              </Button>
            </div>
          </div>
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
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  {pendingRequests.length}
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
                <div 
                  key={friend.friend_id} 
                  className="glass rounded-xl p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => navigate(`/friends/${friend.friend_id}`)}
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-primary-foreground">
                        {friend.friend_username?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">
                          @{friend.friend_username || 'Unknown'}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Trophy className="h-3 w-3" />
                          {friend.friend_points || 0}
                        </div>
                      </div>
                      
                      {/* Compatibility Score with Trend */}
                      <div className="flex items-center gap-2 mt-1">
                        <div className={`flex items-center gap-1 ${getCompatibilityColor(friend.compatibility_score)}`}>
                          <Heart className="h-4 w-4" />
                          <span className="font-bold">
                            {friend.compatibility_score !== null ? `${friend.compatibility_score}%` : '—'}
                          </span>
                        </div>
                        
                        {/* Trend Indicator */}
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

                    {/* Message Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:text-primary hover:bg-primary/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        openChat(friend.friend_id);
                      }}
                      disabled={openConv.isPending}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>

                    {/* Arrow */}
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />

                    {/* Remove Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFriend(friend.friend_id);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
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
                      <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                        <span className="text-lg font-bold text-primary-foreground">
                          {voter.username?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      
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
                        
                        {/* Similarity Score */}
                        <div className="flex items-center gap-2 mt-1">
                          <div className={`flex items-center gap-1 ${getCompatibilityColor(voter.similarity_score)}`}>
                            <Heart className="h-4 w-4" />
                            <span className="font-bold">{voter.similarity_score}%</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {voter.matching_votes}/{voter.shared_polls} shared votes match
                          </span>
                        </div>
                      </div>

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
          <TabsContent value="requests" className="space-y-3">
            {loadingRequests ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No pending requests</h3>
                <p className="text-sm text-muted-foreground">
                  Friend requests will appear here
                </p>
              </div>
            ) : (
              pendingRequests.map((request) => (
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
              ))
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
                      <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                        <span className="text-lg font-bold text-primary-foreground">
                          {user.username?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">
                          @{user.username}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Trophy className="h-3 w-3" />
                          {user.points || 0} points
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <FollowButton creatorId={user.id} variant="icon" />
                        
                        {user.friendship_status === 'accepted' ? (
                          <Button size="sm" variant="secondary" disabled>
                            <UserCheck className="h-4 w-4 mr-1" />
                            Friends
                          </Button>
                        ) : user.friendship_status === 'pending' || hasPendingRequest(user.id) ? (
                          <Button size="sm" variant="secondary" disabled>
                            <Loader2 className="h-4 w-4 mr-1" />
                            Pending
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
