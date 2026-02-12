import { useFriends, FriendVote } from '@/hooks/useFriends';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Heart, Check, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface FriendVotesSectionProps {
  pollId: string;
  userChoice: 'A' | 'B';
  optionA: string;
  optionB: string;
}

export default function FriendVotesSection({ 
  pollId, 
  userChoice, 
  optionA, 
  optionB 
}: FriendVotesSectionProps) {
  const { user } = useAuth();
  const { useFriendVotes, friendCount } = useFriends();
  const { data: friendVotes = [], isLoading } = useFriendVotes(pollId);
  const navigate = useNavigate();

  if (!user) return null;

  // Filter to only show friends who have voted
  const votedFriends = friendVotes.filter(fv => fv.choice !== null);
  const pendingFriends = friendVotes.filter(fv => fv.choice === null);
  const matchingVotes = votedFriends.filter(fv => fv.choice === userChoice);

  if (friendCount === 0) {
    return (
      <div className="mt-4 p-4 rounded-xl bg-secondary/50 border border-border">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Friend Comparison</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Add friends to see how your votes compare!
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/friends')}
          className="w-full"
        >
          Find Friends
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mt-4 p-4 rounded-xl bg-secondary/50 border border-border animate-pulse">
        <div className="h-4 bg-secondary rounded w-1/3 mb-2" />
        <div className="h-10 bg-secondary rounded" />
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 rounded-xl bg-secondary/50 border border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Friends' Votes</span>
        </div>
        {votedFriends.length > 0 && (
          <div className="flex items-center gap-1 text-xs">
            <Heart className="h-3 w-3 text-green-500" />
            <span className="text-green-500 font-medium">
              {matchingVotes.length}/{votedFriends.length} agree
            </span>
          </div>
        )}
      </div>

      {votedFriends.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {pendingFriends.length > 0 
            ? `${pendingFriends.length} friend${pendingFriends.length > 1 ? 's' : ''} haven't voted yet`
            : 'None of your friends have voted on this poll'}
        </p>
      ) : (
        <div className="space-y-2">
          {votedFriends.slice(0, 5).map((friend) => (
            <div 
              key={friend.friend_id} 
              className={`flex items-center gap-3 p-2 rounded-lg ${
                friend.choice === userChoice 
                  ? 'bg-green-500/10 border border-green-500/30' 
                  : 'bg-secondary/50'
              }`}
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary-foreground">
                  {friend.friend_username?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium truncate block">
                  @{friend.friend_username}
                </span>
              </div>

              {/* Vote indicator */}
              <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                friend.choice === 'A' 
                  ? 'bg-option-a/20 text-option-a' 
                  : 'bg-option-b/20 text-option-b'
              }`}>
                {friend.choice === userChoice && <Check className="h-3 w-3" />}
                {friend.choice === 'A' ? optionA : optionB}
              </div>

              {/* Compatibility */}
              {friend.compatibility_score !== null && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Heart className="h-3 w-3" />
                  {friend.compatibility_score}%
                </div>
              )}
            </div>
          ))}

          {votedFriends.length > 5 && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              +{votedFriends.length - 5} more friends
            </p>
          )}

          {pendingFriends.length > 0 && (
            <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {pendingFriends.length} friend{pendingFriends.length > 1 ? 's' : ''} haven't voted yet
            </div>
          )}
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/friends')}
        className="w-full mt-3 text-xs"
      >
        View All Friends
      </Button>
    </div>
  );
}
