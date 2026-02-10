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
    setError(null);
    try {
      const res = await fetch('/api/tournament/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId }),
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
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-400">Loading tournaments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Tournaments</h1>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {tournaments.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-12 text-center">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-xl font-bold mb-2">No Tournaments Yet</h2>
          <p className="text-gray-400">
            Check back later for upcoming tournaments!
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {tournaments.map(tournament => {
            const isParticipant = tournament.participants.some(
              p => p.toLowerCase() === address?.toLowerCase()
            );
            const isFull = tournament.participants.length >= tournament.maxParticipants;

            return (
              <div
                key={tournament.tournamentId}
                className="bg-gray-800 rounded-xl p-6"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-xl font-bold">{tournament.name}</h2>
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${getStatusColor(
                          tournament.status
                        )}`}
                      >
                        {tournament.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Entry Fee</span>
                        <p className="font-medium">{tournament.entryFee} MON</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Prize Pool</span>
                        <p className="font-medium text-green-400">
                          {tournament.prizePool} MON
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-400">Players</span>
                        <p className="font-medium">
                          {tournament.participants.length}/{tournament.maxParticipants}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-400">Starts</span>
                        <p className="font-medium">
                          {new Date(tournament.startAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {tournament.status === 'registration' && !isParticipant && !isFull && (
                      <button
                        onClick={() => enterTournament(tournament.tournamentId)}
                        className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg font-medium transition"
                      >
                        Enter Tournament
                      </button>
                    )}

                    {isParticipant && (
                      <span className="text-green-400 text-sm">
                        Registered
                      </span>
                    )}

                    {isFull && !isParticipant && (
                      <span className="text-yellow-400 text-sm">
                        Tournament full
                      </span>
                    )}
                  </div>
                </div>

                {/* Bracket preview */}
                {tournament.bracket.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-700">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">
                      Bracket
                    </h3>
                    <div className="flex gap-8 overflow-x-auto pb-4">
                      {Array.from(
                        new Set(tournament.bracket.map(m => m.round))
                      ).map(round => (
                        <div key={round} className="min-w-[200px]">
                          <div className="text-xs text-gray-500 mb-2">
                            Round {round}
                          </div>
                          <div className="space-y-2">
                            {tournament.bracket
                              .filter(m => m.round === round)
                              .map((match, idx) => (
                                <div
                                  key={idx}
                                  className="bg-gray-700 rounded p-2 text-xs"
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
                  <div className="mt-4 pt-4 border-t border-gray-700 text-center">
                    <span className="text-yellow-400">
                      Winner: {tournament.winner.slice(0, 6)}...
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
