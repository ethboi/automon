'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import { Tournament } from '@/lib/types';

export default function TournamentPage() {
  const { address } = useWallet();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTournaments();
  }, [address]);

  const fetchTournaments = async () => {
    try {
      const res = await fetch('/api/tournament/list');
      const data = await res.json();
      setTournaments(data.tournaments || []);
    } catch (error) {
      console.error('Failed to fetch tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const enterTournament = async (tournamentId: string) => {
    if (!address) {
      setError('Please connect your wallet first.');
      return;
    }
    setError(null);
    try {
      const res = await fetch('/api/tournament/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, address }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to enter tournament');
      }

      fetchTournaments();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'bg-blue-500/20 text-blue-400';
      case 'registration':
        return 'bg-green-500/20 text-green-400';
      case 'active':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'complete':
        return 'bg-gray-500/20 text-gray-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="spinner mb-4" />
          <p className="text-gray-400 animate-pulse">Loading tournaments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container page-transition">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-1 sm:mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          Tournaments
        </h1>
        <p className="text-sm sm:text-base text-gray-400">Compete in organized tournaments for prizes</p>
      </div>

      {error && (
        <div className="glass border border-red-500/30 rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6 animate-scale-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-lg sm:text-xl">⚠️</span>
            </div>
            <p className="text-sm sm:text-base text-red-400">{error}</p>
          </div>
        </div>
      )}

      {tournaments.length === 0 ? (
        <div className="section-card text-center py-8 sm:py-12">
          <div className="text-5xl sm:text-6xl mb-3 sm:mb-4 opacity-50">🏆</div>
          <h2 className="text-lg sm:text-xl font-bold mb-2">No Tournaments Yet</h2>
          <p className="text-sm sm:text-base text-gray-400">
            Check back later for upcoming tournaments!
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-6">
          {tournaments.map(tournament => {
            const isParticipant = tournament.participants.some(
              p => p.toLowerCase() === address?.toLowerCase()
            );
            const isFull = tournament.participants.length >= tournament.maxParticipants;

            return (
              <div
                key={tournament.tournamentId}
                className="section-card"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                      <h2 className="text-base sm:text-xl font-bold truncate">{tournament.name}</h2>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium ${getStatusColor(
                          tournament.status
                        )}`}
                      >
                        {tournament.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm">
                      <div>
                        <span className="text-gray-400 block">Entry Fee</span>
                        <p className="font-medium">{tournament.entryFee} MON</p>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Prize Pool</span>
                        <p className="font-medium text-green-400">
                          {tournament.prizePool} MON
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Players</span>
                        <p className="font-medium">
                          {tournament.participants.length}/{tournament.maxParticipants}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Starts</span>
                        <p className="font-medium">
                          {new Date(tournament.startAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-start md:items-end gap-2">
                    {tournament.status === 'registration' && !isParticipant && !isFull && (
                      <button
                        onClick={() => enterTournament(tournament.tournamentId)}
                        className="btn-primary w-full sm:w-auto min-h-[44px] px-4 sm:px-6 py-2.5"
                      >
                        Enter Tournament
                      </button>
                    )}

                    {isParticipant && (
                      <span className="text-green-400 text-xs sm:text-sm">
                        ✅ Registered
                      </span>
                    )}

                    {isFull && !isParticipant && (
                      <span className="text-yellow-400 text-xs sm:text-sm">
                        Tournament full
                      </span>
                    )}
                  </div>
                </div>

                {/* Bracket preview */}
                {tournament.bracket.length > 0 && (
                  <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-white/10">
                    <h3 className="text-xs sm:text-sm font-medium text-gray-400 mb-2 sm:mb-3">
                      Bracket
                    </h3>
                    <div className="flex gap-3 sm:gap-8 overflow-x-auto pb-3 sm:pb-4 -mx-3 sm:-mx-6 px-3 sm:px-6">
                      {Array.from(
                        new Set(tournament.bracket.map(m => m.round))
                      ).map(round => (
                        <div key={round} className="min-w-[160px] sm:min-w-[200px]">
                          <div className="text-[10px] sm:text-xs text-gray-500 mb-2">
                            Round {round}
                          </div>
                          <div className="space-y-1.5 sm:space-y-2">
                            {tournament.bracket
                              .filter(m => m.round === round)
                              .map((match, idx) => (
                                <div
                                  key={idx}
                                  className="glass-light rounded-lg p-2 text-xs"
                                >
                                  <div
                                    className={
                                      match.winner === match.player1
                                        ? 'text-green-400'
                                        : ''
                                    }
                                  >
                                    {match.player1
                                      ? `${match.player1.slice(0, 6)}...`
                                      : 'TBD'}
                                  </div>
                                  <div className="text-gray-500">vs</div>
                                  <div
                                    className={
                                      match.winner === match.player2
                                        ? 'text-green-400'
                                        : ''
                                    }
                                  >
                                    {match.player2
                                      ? `${match.player2.slice(0, 6)}...`
                                      : 'TBD'}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tournament.winner && (
                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10 text-center">
                    <span className="text-yellow-400 text-sm sm:text-base">
                      🏆 Winner: {tournament.winner.slice(0, 6)}...
                      {tournament.winner.slice(-4)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
