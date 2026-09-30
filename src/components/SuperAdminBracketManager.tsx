import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Crown,
  Zap,
  Flame,
  CheckCircle2,
  Save,
  RotateCcw,
  Sparkles,
  Edit3,
  Calendar,
  Clock,
  MapPin,
  ChevronDown,
  Eye,
  X
} from 'lucide-react';
import { KnockoutMatch, TournamentMatch } from '../data/padelProTournamentsData';
import {
  getStoredTournaments,
  saveTournament,
  getOrGeneratePoolMatches,
  savePoolMatch
} from '../data/tournamentStorage';
import {
  KnockoutBracketData,
  getStoredBracket,
  saveStoredBracket,
  resetStoredBracket,
  generateBracketForPoolCount
} from '../data/bracketStorage';
import { getStoredTournamentGroups } from '../data/tournamentGroupStorage';
import { KnockoutBracketVisualizer } from './KnockoutBracketVisualizer';

export interface ActiveEditMatch {
  matchType: 'knockout' | 'pool';
  roundType?: 'roundOf16' | 'quarters' | 'semis' | 'grandFinal' | 'bronzeMatch';
  index?: number;
  poolName?: string;
  originalPoolMatch?: TournamentMatch;
  match: KnockoutMatch;
}

interface SuperAdminBracketManagerProps {
  initialTournamentId?: string;
  onBracketSaved?: () => void;
}

export const SuperAdminBracketManager: React.FC<SuperAdminBracketManagerProps> = ({
  initialTournamentId = 'rookie-mix',
  onBracketSaved
}) => {
  const [tournaments, setTournaments] = useState(() => getStoredTournaments());
  const [selectedTournament, setSelectedTournament] = useState<string>(initialTournamentId);
  const [bracketData, setBracketData] = useState<KnockoutBracketData>(() =>
    getStoredBracket(initialTournamentId)
  );
  const [poolMatches, setPoolMatches] = useState<TournamentMatch[]>(() =>
    getOrGeneratePoolMatches(initialTournamentId)
  );
  const [activeRoundTab, setActiveRoundTab] = useState<string>('all');
  const [editingMatch, setEditingMatch] = useState<ActiveEditMatch | null>(null);

  const [notification, setNotification] = useState<{
    type: 'success' | 'info' | 'warning';
    message: string;
  } | null>(null);

  // Dynamically obtain pools for the selected tournament
  const tournamentPools: string[] = React.useMemo(() => {
    if (!selectedTournament) return ['Pool A', 'Pool B'];
    const groups = getStoredTournamentGroups(selectedTournament);
    if (groups && groups.length > 0) {
      return groups.map((g) => g.poolName);
    }
    const current = tournaments.find((t) => t.id === selectedTournament);
    if (current?.groupStandings?.pools) {
      return current.groupStandings.pools.filter((p) => p !== 'Semua Pool');
    }
    return ['Pool A', 'Pool B'];
  }, [selectedTournament, tournaments]);

  // Sync when initialTournamentId prop changes
  useEffect(() => {
    if (initialTournamentId) {
      setSelectedTournament(initialTournamentId);
    }
  }, [initialTournamentId]);

  // Reactive listener for tournament and group updates
  useEffect(() => {
    const handleTournamentsUpdate = () => {
      const updated = getStoredTournaments();
      setTournaments(updated);
      if (!updated.some((t) => t.id === selectedTournament)) {
        setSelectedTournament(updated.length > 0 ? updated[0].id : '');
      }
      setBracketData(getStoredBracket(selectedTournament));
      setPoolMatches(getOrGeneratePoolMatches(selectedTournament));
    };
    const handleGroupsUpdate = () => {
      setPoolMatches(getOrGeneratePoolMatches(selectedTournament));
    };
    const handleBracketUpdate = (e: Event) => {
      const custom = e as CustomEvent;
      if (!custom.detail?.tournamentId || custom.detail.tournamentId === selectedTournament) {
        setBracketData(getStoredBracket(selectedTournament));
      }
    };

    window.addEventListener('lagilagipadel_tournaments_updated', handleTournamentsUpdate);
    window.addEventListener('lagilagipadel_groups_updated', handleGroupsUpdate);
    window.addEventListener('lagilagipadel_bracket_updated', handleBracketUpdate);
    return () => {
      window.removeEventListener('lagilagipadel_tournaments_updated', handleTournamentsUpdate);
      window.removeEventListener('lagilagipadel_groups_updated', handleGroupsUpdate);
      window.removeEventListener('lagilagipadel_bracket_updated', handleBracketUpdate);
    };
  }, [selectedTournament]);

  // Sync when tournament changes
  useEffect(() => {
    const data = getStoredBracket(selectedTournament);
    setBracketData(data);
    setPoolMatches(getOrGeneratePoolMatches(selectedTournament));
  }, [selectedTournament]);

  const showToast = (message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Quick switch knockout format for the selected tournament
  const handleSwitchKnockoutStage = (newStage: 'final' | 'semis' | 'quarters' | 'roundOf16') => {
    const poolCount = tournamentPools.length || 2;
    const newBracket = generateBracketForPoolCount(poolCount, newStage);
    setBracketData(newBracket);
    saveStoredBracket(selectedTournament, newBracket);

    const tourney = tournaments.find((t) => t.id === selectedTournament);
    if (tourney) {
      const updatedTourney = {
        ...tourney,
        knockoutBracket: newBracket
      };
      saveTournament(updatedTourney);
    }

    const stageLabel =
      newStage === 'final'
        ? 'Langsung Grand Final (Juara Pool)'
        : newStage === 'semis'
        ? 'Babak Semifinal & Final'
        : newStage === 'quarters'
        ? 'Babak Perempat Final (QF) s.d. Final'
        : 'Babak 16 Besar (R16) s.d. Final';

    showToast(`Format bagan sistem gugur berhasil diubah ke: ${stageLabel}`, 'success');
  };

  // Save changes to localStorage & trigger global update event
  const handleSaveAll = () => {
    saveStoredBracket(selectedTournament, bracketData);
    showToast(
      'Bagan sistem gugur (Knockout Bracket) berhasil disimpan dan diperbarui langsung ke halaman tamu!',
      'success'
    );
    if (onBracketSaved) onBracketSaved();
  };

  // Reset to original factory tournament bracket
  const handleResetBracket = () => {
    const defaultData = resetStoredBracket(selectedTournament);
    setBracketData(defaultData);
    showToast('Bagan sistem gugur berhasil dikembalikan ke data awal turnamen.', 'info');
    if (onBracketSaved) onBracketSaved();
  };

  // Smart Auto-Advance: Takes winners of each round and seeds them to subsequent rounds
  const handleAutoAdvance = () => {
    const updated: KnockoutBracketData = JSON.parse(JSON.stringify(bracketData));
    let advancedCount = 0;

    // 1. Advance R16 winners to Quarters
    if (updated.roundOf16 && updated.roundOf16.length === 8 && updated.quarters.length >= 4) {
      // QF1: R16-1 vs R16-2
      const w1 = updated.roundOf16[0].team1.isWinner
        ? updated.roundOf16[0].team1
        : updated.roundOf16[0].team2;
      const w2 = updated.roundOf16[1].team1.isWinner
        ? updated.roundOf16[1].team1
        : updated.roundOf16[1].team2;
      if (w1.name && w1.score) {
        updated.quarters[0].team1.name = w1.name;
        updated.quarters[0].team1.players = w1.players;
      }
      if (w2.name && w2.score) {
        updated.quarters[0].team2.name = w2.name;
        updated.quarters[0].team2.players = w2.players;
      }

      // QF2: R16-3 vs R16-4
      const w3 = updated.roundOf16[2].team1.isWinner
        ? updated.roundOf16[2].team1
        : updated.roundOf16[2].team2;
      const w4 = updated.roundOf16[3].team1.isWinner
        ? updated.roundOf16[3].team1
        : updated.roundOf16[3].team2;
      if (w3.name && w3.score) {
        updated.quarters[1].team1.name = w3.name;
        updated.quarters[1].team1.players = w3.players;
      }
      if (w4.name && w4.score) {
        updated.quarters[1].team2.name = w4.name;
        updated.quarters[1].team2.players = w4.players;
      }

      // QF3: R16-5 vs R16-6
      const w5 = updated.roundOf16[4].team1.isWinner
        ? updated.roundOf16[4].team1
        : updated.roundOf16[4].team2;
      const w6 = updated.roundOf16[5].team1.isWinner
        ? updated.roundOf16[5].team1
        : updated.roundOf16[5].team2;
      if (w5.name && w5.score) {
        updated.quarters[2].team1.name = w5.name;
        updated.quarters[2].team1.players = w5.players;
      }
      if (w6.name && w6.score) {
        updated.quarters[2].team2.name = w6.name;
        updated.quarters[2].team2.players = w6.players;
      }

      // QF4: R16-7 vs R16-8
      const w7 = updated.roundOf16[6].team1.isWinner
        ? updated.roundOf16[6].team1
        : updated.roundOf16[6].team2;
      const w8 = updated.roundOf16[7].team1.isWinner
        ? updated.roundOf16[7].team1
        : updated.roundOf16[7].team2;
      if (w7.name && w7.score) {
        updated.quarters[3].team1.name = w7.name;
        updated.quarters[3].team1.players = w7.players;
      }
      if (w8.name && w8.score) {
        updated.quarters[3].team2.name = w8.name;
        updated.quarters[3].team2.players = w8.players;
      }
      advancedCount += 8;
    }

    // 2. Advance Quarters winners to Semis
    if (updated.quarters && updated.quarters.length >= 4 && updated.semis.length >= 2) {
      // SF1: QF1 vs QF2
      const qf1W = updated.quarters[0].team1.isWinner
        ? updated.quarters[0].team1
        : updated.quarters[0].team2;
      const qf2W = updated.quarters[1].team1.isWinner
        ? updated.quarters[1].team1
        : updated.quarters[1].team2;
      if (qf1W.name && qf1W.score) {
        updated.semis[0].team1.name = qf1W.name;
        updated.semis[0].team1.players = qf1W.players;
      }
      if (qf2W.name && qf2W.score) {
        updated.semis[0].team2.name = qf2W.name;
        updated.semis[0].team2.players = qf2W.players;
      }

      // SF2: QF3 vs QF4
      const qf3W = updated.quarters[2].team1.isWinner
        ? updated.quarters[2].team1
        : updated.quarters[2].team2;
      const qf4W = updated.quarters[3].team1.isWinner
        ? updated.quarters[3].team1
        : updated.quarters[3].team2;
      if (qf3W.name && qf3W.score) {
        updated.semis[1].team1.name = qf3W.name;
        updated.semis[1].team1.players = qf3W.players;
      }
      if (qf4W.name && qf4W.score) {
        updated.semis[1].team2.name = qf4W.name;
        updated.semis[1].team2.players = qf4W.players;
      }
      advancedCount += 4;
    }

    // 3. Advance Semis to Grand Final and Bronze Match
    if (updated.semis && updated.semis.length >= 2) {
      const sf1Winner = updated.semis[0].team1.isWinner
        ? updated.semis[0].team1
        : updated.semis[0].team2;
      const sf1Loser = updated.semis[0].team1.isWinner
        ? updated.semis[0].team2
        : updated.semis[0].team1;

      const sf2Winner = updated.semis[1].team1.isWinner
        ? updated.semis[1].team1
        : updated.semis[1].team2;
      const sf2Loser = updated.semis[1].team1.isWinner
        ? updated.semis[1].team2
        : updated.semis[1].team1;

      // Grand Final
      if (sf1Winner.name && sf1Winner.score) {
        updated.grandFinal.team1.name = sf1Winner.name;
        updated.grandFinal.team1.players = sf1Winner.players;
      }
      if (sf2Winner.name && sf2Winner.score) {
        updated.grandFinal.team2.name = sf2Winner.name;
        updated.grandFinal.team2.players = sf2Winner.players;
      }

      // Bronze Match
      if (updated.bronzeMatch) {
        if (sf1Loser.name) {
          updated.bronzeMatch.team1.name = sf1Loser.name;
          updated.bronzeMatch.team1.players = sf1Loser.players;
        }
        if (sf2Loser.name) {
          updated.bronzeMatch.team2.name = sf2Loser.name;
          updated.bronzeMatch.team2.players = sf2Loser.players;
        }
      }
      advancedCount += 4;
    }

    setBracketData(updated);
    saveStoredBracket(selectedTournament, updated);
    showToast(
      `Otomatisasi berhasil! ${advancedCount} tim pemenang telah dimajukan ke babak berikutnya dan disimpan.`,
      'success'
    );
  };

  // Open Edit Modal for a knockout match
  const handleOpenEditMatch = (
    match: KnockoutMatch,
    roundType: 'roundOf16' | 'quarters' | 'semis' | 'grandFinal' | 'bronzeMatch',
    index?: number
  ) => {
    setEditingMatch({
      matchType: 'knockout',
      match: JSON.parse(JSON.stringify(match)),
      roundType,
      index
    });
  };

  // Open Edit Modal for a pool match
  const handleOpenEditPoolMatch = (match: TournamentMatch, poolName: string) => {
    setEditingMatch({
      matchType: 'pool',
      poolName,
      originalPoolMatch: match,
      match: {
        id: match.id,
        roundTitle: match.round,
        court: match.court || 'Court 1',
        time: match.time || '09:00 WIB',
        team1: {
          name: match.teamA,
          players: match.playersA,
          score: match.scoreA,
          isWinner: match.winner === 'A'
        },
        team2: {
          name: match.teamB,
          players: match.playersB,
          score: match.scoreB,
          isWinner: match.winner === 'B'
        },
        status: match.status
      }
    });
  };

  // Apply match edit to state and persistence
  const handleSaveMatchEdit = () => {
    if (!editingMatch) return;

    // Handle Pool Match Save
    if (editingMatch.matchType === 'pool') {
      const { match } = editingMatch;
      const winnerChoice: 'A' | 'B' | 'live' | 'scheduled' = match.team1.isWinner
        ? 'A'
        : match.team2.isWinner
        ? 'B'
        : match.status === 'Live'
        ? 'live'
        : 'scheduled';

      const updatedTournamentMatch: TournamentMatch = {
        id: match.id,
        round: match.roundTitle,
        roundCategory: 'grup',
        court: match.court,
        time: match.time,
        teamA: match.team1.name,
        playersA: match.team1.players,
        teamB: match.team2.name,
        playersB: match.team2.players,
        scoreA: match.team1.score,
        scoreB: match.team2.score,
        winner: winnerChoice,
        status: match.status
      };

      savePoolMatch(selectedTournament, updatedTournamentMatch);
      setPoolMatches(getOrGeneratePoolMatches(selectedTournament));
      setEditingMatch(null);
      showToast(`Pertandingan ${match.roundTitle} berhasil diperbarui & klasemen disinkronkan!`, 'success');
      return;
    }

    // Handle Knockout Match Save
    const { match, roundType, index } = editingMatch;
    const updated: KnockoutBracketData = JSON.parse(JSON.stringify(bracketData));

    if (roundType === 'grandFinal') {
      updated.grandFinal = match;
    } else if (roundType === 'bronzeMatch') {
      updated.bronzeMatch = match;
    } else if (roundType === 'roundOf16' && updated.roundOf16 && index !== undefined) {
      updated.roundOf16[index] = match;
    } else if (roundType === 'quarters' && index !== undefined) {
      updated.quarters[index] = match;
    } else if (roundType === 'semis' && index !== undefined) {
      updated.semis[index] = match;
    }

    setBracketData(updated);
    saveStoredBracket(selectedTournament, updated);
    setEditingMatch(null);
    showToast(`Pertandingan ${match.roundTitle} berhasil diperbarui!`, 'success');
  };

  // Inline quick winner toggler for Knockout
  const handleToggleWinnerInline = (
    roundType: 'roundOf16' | 'quarters' | 'semis' | 'grandFinal' | 'bronzeMatch',
    index: number | undefined,
    winnerTeam: 1 | 2
  ) => {
    const updated: KnockoutBracketData = JSON.parse(JSON.stringify(bracketData));
    let target: KnockoutMatch;

    if (roundType === 'grandFinal') {
      target = updated.grandFinal;
    } else if (roundType === 'bronzeMatch' && updated.bronzeMatch) {
      target = updated.bronzeMatch;
    } else if (roundType === 'roundOf16' && updated.roundOf16 && index !== undefined) {
      target = updated.roundOf16[index];
    } else if (roundType === 'quarters' && index !== undefined) {
      target = updated.quarters[index];
    } else if (roundType === 'semis' && index !== undefined) {
      target = updated.semis[index];
    } else {
      return;
    }

    if (winnerTeam === 1) {
      target.team1.isWinner = true;
      target.team2.isWinner = false;
    } else {
      target.team1.isWinner = false;
      target.team2.isWinner = true;
    }
    target.status = 'Selesai';

    setBracketData(updated);
    saveStoredBracket(selectedTournament, updated);
    showToast(`Pemenang ${target.roundTitle} diset ke Tim ${winnerTeam}!`, 'info');
  };

  // Inline quick winner toggler for Pool Matches
  const handleTogglePoolWinnerInline = (match: TournamentMatch, winnerChoice: 'A' | 'B') => {
    const currentA = match.scoreA && match.scoreA !== '-' ? match.scoreA : winnerChoice === 'A' ? '4' : '2';
    const currentB = match.scoreB && match.scoreB !== '-' ? match.scoreB : winnerChoice === 'B' ? '4' : '2';
    const updated: TournamentMatch = {
      ...match,
      winner: winnerChoice,
      status: 'Selesai',
      scoreA: currentA,
      scoreB: currentB
    };
    savePoolMatch(selectedTournament, updated);
    setPoolMatches(getOrGeneratePoolMatches(selectedTournament));
    showToast(
      `Pemenang ${match.round} diset ke ${winnerChoice === 'A' ? match.teamA : match.teamB}!`,
      'info'
    );
  };

  // Dynamic participant dropdown grouping for modal
  const getParticipantDropdownGroups = (teamNumber: 1 | 2) => {
    if (!editingMatch) {
      return { recommendations: [], poolGroups: [], knockoutWinners: [], placeholders: [] };
    }

    const currentTourney = tournaments.find((t) => t.id === selectedTournament);
    const groups = getStoredTournamentGroups(selectedTournament);
    const roundTitle = editingMatch.match.roundTitle || '';
    const isPoolMatch = editingMatch.matchType === 'pool';

    // 1. Gather all pool groups and their teams
    const poolGroupsList: { poolName: string; teams: { name: string; players: string; club?: string; seed?: number }[] }[] = [];

    if (groups && groups.length > 0) {
      groups.forEach((g) => {
        poolGroupsList.push({
          poolName: g.poolName,
          teams: g.teams.map((t) => ({
            name: t.name,
            players: t.p1 && t.p2 ? `${t.p1} / ${t.p2}` : t.name,
            club: t.club,
            seed: t.seed
          }))
        });
      });
    } else if (currentTourney?.groupStandings?.standings) {
      const pools = currentTourney.groupStandings.pools.filter((p) => p !== 'Semua Pool');
      pools.forEach((pName) => {
        const teams = currentTourney.groupStandings.standings
          .filter((s) => s.pool === pName)
          .map((s) => ({
            name: s.name,
            players: s.p1 && s.p2 ? `${s.p1} / ${s.p2}` : s.name,
            club: currentTourney.participants?.find((p) => p.teamName === s.name)?.club || '',
            seed: s.pos
          }));
        poolGroupsList.push({ poolName: pName, teams });
      });
    }

    // 2. Smart recommendations based on match round and team number
    const recommendations: { label: string; name: string; players: string }[] = [];

    if (isPoolMatch && editingMatch.poolName) {
      const pool = poolGroupsList.find((g) => g.poolName === editingMatch.poolName);
      if (pool) {
        pool.teams.forEach((t) => {
          recommendations.push({
            label: `${t.name} (${editingMatch.poolName} ${t.seed ? `· Seed ${t.seed}` : ''})`,
            name: t.name,
            players: t.players
          });
        });
      }
    } else {
      const titleLower = roundTitle.toLowerCase();
      let targetPool = '';
      if (teamNumber === 1) {
        if (titleLower.includes('pool a')) targetPool = 'Pool A';
        else if (titleLower.includes('pool c')) targetPool = 'Pool C';
        else if (titleLower.includes('pool 1')) targetPool = 'Pool 1';
      } else {
        if (titleLower.includes('pool b')) targetPool = 'Pool B';
        else if (titleLower.includes('pool d')) targetPool = 'Pool D';
        else if (titleLower.includes('pool 2')) targetPool = 'Pool 2';
      }

      if (targetPool) {
        const foundPool = poolGroupsList.find((g) => g.poolName.toLowerCase() === targetPool.toLowerCase());
        if (foundPool && foundPool.teams.length > 0) {
          foundPool.teams.forEach((t) => {
            recommendations.push({
              label: `${t.name} (${targetPool} ${t.seed ? `· Seed ${t.seed}` : ''})`,
              name: t.name,
              players: t.players
            });
          });
        }
      }

      // Standard placeholders
      if (teamNumber === 1) {
        if (titleLower.includes('pool a')) {
          recommendations.unshift({ label: 'Juara Pool A (Format Standar)', name: 'Juara Pool A', players: 'TBD' });
        } else if (titleLower.includes('qf 1')) {
          recommendations.unshift({ label: 'Pemenang QF 1 (Format Standar)', name: 'Pemenang QF 1', players: 'TBD' });
        } else if (titleLower.includes('semifinal 1')) {
          recommendations.unshift({ label: 'Pemenang Semifinal 1 (Format Standar)', name: 'Pemenang Semifinal 1', players: 'TBD' });
        }
      } else {
        if (titleLower.includes('pool b')) {
          recommendations.unshift({ label: 'Runner-up Pool B (Format Standar)', name: 'Runner-up Pool B', players: 'TBD' });
        } else if (titleLower.includes('qf 2')) {
          recommendations.unshift({ label: 'Pemenang QF 2 (Format Standar)', name: 'Pemenang QF 2', players: 'TBD' });
        } else if (titleLower.includes('semifinal 2')) {
          recommendations.unshift({ label: 'Pemenang Semifinal 2 (Format Standar)', name: 'Pemenang Semifinal 2', players: 'TBD' });
        }
      }
    }

    // 3. Knockout previous winners
    const knockoutWinners: { label: string; name: string; players: string }[] = [];
    if (bracketData.quarters) {
      bracketData.quarters.forEach((q, idx) => {
        const w = q.team1.isWinner ? q.team1 : q.team2.isWinner ? q.team2 : null;
        if (w && w.name && !w.name.toLowerCase().includes('menunggu') && !w.name.toLowerCase().includes('tbd')) {
          knockoutWinners.push({
            label: `${w.name} (Pemenang QF ${idx + 1})`,
            name: w.name,
            players: w.players || 'TBD'
          });
        }
      });
    }
    if (bracketData.semis) {
      bracketData.semis.forEach((s, idx) => {
        const w = s.team1.isWinner ? s.team1 : s.team2.isWinner ? s.team2 : null;
        if (w && w.name && !w.name.toLowerCase().includes('menunggu') && !w.name.toLowerCase().includes('tbd')) {
          knockoutWinners.push({
            label: `${w.name} (Pemenang Semifinal ${idx + 1})`,
            name: w.name,
            players: w.players || 'TBD'
          });
        }
      });
    }

    // 4. Standard Placeholders
    const placeholders = [
      { label: 'Juara Pool A', name: 'Juara Pool A', players: 'TBD' },
      { label: 'Runner-up Pool A', name: 'Runner-up Pool A', players: 'TBD' },
      { label: 'Juara Pool B', name: 'Juara Pool B', players: 'TBD' },
      { label: 'Runner-up Pool B', name: 'Runner-up Pool B', players: 'TBD' },
      { label: 'Juara Pool C', name: 'Juara Pool C', players: 'TBD' },
      { label: 'Runner-up Pool C', name: 'Runner-up Pool C', players: 'TBD' },
      { label: 'Juara Pool D', name: 'Juara Pool D', players: 'TBD' },
      { label: 'Runner-up Pool D', name: 'Runner-up Pool D', players: 'TBD' },
      { label: 'Pemenang QF 1', name: 'Pemenang QF 1', players: 'TBD' },
      { label: 'Pemenang QF 2', name: 'Pemenang QF 2', players: 'TBD' },
      { label: 'Pemenang QF 3', name: 'Pemenang QF 3', players: 'TBD' },
      { label: 'Pemenang QF 4', name: 'Pemenang QF 4', players: 'TBD' },
      { label: 'Pemenang Semifinal 1', name: 'Pemenang Semifinal 1', players: 'TBD' },
      { label: 'Pemenang Semifinal 2', name: 'Pemenang Semifinal 2', players: 'TBD' },
      { label: 'Kalah Semifinal 1', name: 'Kalah Semifinal 1', players: 'TBD' },
      { label: 'Kalah Semifinal 2', name: 'Kalah Semifinal 2', players: 'TBD' },
      { label: 'Finalis 1', name: 'Finalis 1', players: 'TBD' },
      { label: 'Finalis 2', name: 'Finalis 2', players: 'TBD' },
      { label: 'TBD / Bye', name: 'TBD', players: 'TBD' }
    ];

    return {
      recommendations,
      poolGroups: poolGroupsList,
      knockoutWinners,
      placeholders
    };
  };

  // Helper render for pool matches (both finished & scheduled)
  const renderPoolMatchRow = (match: TournamentMatch, poolName: string) => {
    const isWinnerA = match.winner === 'A';
    const isWinnerB = match.winner === 'B';
    const isLive = match.status === 'Live';

    return (
      <div
        key={match.id}
        className={`p-4 rounded-2xl border transition-all shadow-xs space-y-3 ${
          isLive
            ? 'bg-gradient-to-r from-red-50 to-white border-red-300 ring-1 ring-red-400'
            : 'bg-white border-[#D8DFDE] hover:border-[#006A6A]'
        }`}
      >
        {/* Match Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#D8DFDE]">
          <div className="flex items-center gap-2">
            <span className="bg-[#006A6A] text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md tracking-wider">
              {match.court || 'COURT #1'}
            </span>
            <span className="text-xs font-bold font-mono text-[#191C1C]">
              {match.round}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                match.status === 'Live'
                  ? 'bg-red-600 text-white animate-pulse'
                  : match.status === 'Selesai'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-[#EEF4F3] text-[#3D5A57]'
              }`}
            >
              {match.status === 'Live' ? '● LIVE' : match.status === 'Selesai' ? '✓ SELESAI' : '🕒 ' + match.time}
            </span>
            <button
              onClick={() => handleOpenEditPoolMatch(match, poolName)}
              className="px-2.5 py-1 rounded-lg bg-[#006A6A]/10 hover:bg-[#006A6A] text-[#006A6A] hover:text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Skor & Detail</span>
            </button>
          </div>
        </div>

        {/* Teams and Quick Winner Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Team A Card */}
          <div
            className={`p-3 rounded-xl border transition-all ${
              isWinnerA
                ? 'bg-[#E6F4F2] border-[#006A6A]/50 text-[#004F4F]'
                : 'bg-[#F6FAF9] border-[#D8DFDE] text-[#475569]'
            }`}
          >
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <div className="font-bold text-sm text-[#191C1C] truncate">
                  {match.teamA || 'Tim 1 (Belum Diisi)'}
                </div>
                <div className="text-[11px] text-[#6F7978] truncate">
                  {match.playersA || '-'}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono text-base font-black text-[#006A6A] block">
                  {match.scoreA}
                </span>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-black/5 flex items-center justify-between">
              <span className="text-[10px] font-mono font-semibold uppercase">
                {isWinnerA ? '🏆 PEMENANG RESMI' : 'Tim 1 (A)'}
              </span>
              <button
                type="button"
                onClick={() => handleTogglePoolWinnerInline(match, 'A')}
                className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  isWinnerA
                    ? 'bg-[#006A6A] text-white'
                    : 'bg-white border border-[#D8DFDE] hover:border-[#006A6A] text-[#191C1C]'
                }`}
              >
                {isWinnerA ? '✓ Juara / Menang' : 'Pilih Pemenang'}
              </button>
            </div>
          </div>

          {/* Team B Card */}
          <div
            className={`p-3 rounded-xl border transition-all ${
              isWinnerB
                ? 'bg-[#E6F4F2] border-[#006A6A]/50 text-[#004F4F]'
                : 'bg-[#F6FAF9] border-[#D8DFDE] text-[#475569]'
            }`}
          >
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <div className="font-bold text-sm text-[#191C1C] truncate">
                  {match.teamB || 'Tim 2 (Belum Diisi)'}
                </div>
                <div className="text-[11px] text-[#6F7978] truncate">
                  {match.playersB || '-'}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono text-base font-black text-[#006A6A] block">
                  {match.scoreB}
                </span>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-black/5 flex items-center justify-between">
              <span className="text-[10px] font-mono font-semibold uppercase">
                {isWinnerB ? '🏆 PEMENANG RESMI' : 'Tim 2 (B)'}
              </span>
              <button
                type="button"
                onClick={() => handleTogglePoolWinnerInline(match, 'B')}
                className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  isWinnerB
                    ? 'bg-[#006A6A] text-white'
                    : 'bg-white border border-[#D8DFDE] hover:border-[#006A6A] text-[#191C1C]'
                }`}
              >
                {isWinnerB ? '✓ Juara / Menang' : 'Pilih Pemenang'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Helper render for quick match item card
  const renderMatchRow = (
    match: KnockoutMatch,
    roundType: 'roundOf16' | 'quarters' | 'semis' | 'grandFinal' | 'bronzeMatch',
    index?: number
  ) => {
    return (
      <div
        key={match.id || index}
        className="p-4 rounded-2xl bg-white border border-[#D8DFDE] hover:border-[#006A6A] transition-all shadow-xs space-y-3"
      >
        {/* Match Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#D8DFDE]">
          <div className="flex items-center gap-2">
            <span className="bg-[#006A6A] text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md tracking-wider">
              {match.court || 'COURT #1'}
            </span>
            <span className="text-xs font-bold font-mono text-[#191C1C]">
              {match.roundTitle}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#006A6A] font-semibold bg-[#E6F4F2] px-2 py-0.5 rounded-md">
              🕒 {match.time || '18:00'}
            </span>
            <button
              onClick={() => handleOpenEditMatch(match, roundType, index)}
              className="px-2.5 py-1 rounded-lg bg-[#006A6A]/10 hover:bg-[#006A6A] text-[#006A6A] hover:text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Skor & Detail</span>
            </button>
          </div>
        </div>

        {/* Teams and Quick Winner Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Team 1 Card */}
          <div
            className={`p-3 rounded-xl border transition-all ${
              match.team1.isWinner
                ? 'bg-[#E6F4F2] border-[#006A6A]/50 text-[#004F4F]'
                : 'bg-[#F6FAF9] border-[#D8DFDE] text-[#475569]'
            }`}
          >
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <div className="font-bold text-sm text-[#191C1C] truncate">
                  {match.team1.name || 'Tim 1 (Belum Diisi)'}
                </div>
                <div className="text-[11px] text-[#6F7978] truncate">
                  {match.team1.players || '-'}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono text-base font-black text-[#006A6A] block">
                  {match.team1.score}
                </span>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-black/5 flex items-center justify-between">
              <span className="text-[10px] font-mono font-semibold uppercase">
                {match.team1.isWinner ? '🏆 PEMENANG RESMI' : 'Tim 1'}
              </span>
              <button
                type="button"
                onClick={() => handleToggleWinnerInline(roundType, index, 1)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  match.team1.isWinner
                    ? 'bg-[#006A6A] text-white'
                    : 'bg-white border border-[#D8DFDE] hover:border-[#006A6A] text-[#191C1C]'
                }`}
              >
                {match.team1.isWinner ? '✓ Juara / Lolos' : 'Pilih Pemenang'}
              </button>
            </div>
          </div>

          {/* Team 2 Card */}
          <div
            className={`p-3 rounded-xl border transition-all ${
              match.team2.isWinner
                ? 'bg-[#E6F4F2] border-[#006A6A]/50 text-[#004F4F]'
                : 'bg-[#F6FAF9] border-[#D8DFDE] text-[#475569]'
            }`}
          >
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <div className="font-bold text-sm text-[#191C1C] truncate">
                  {match.team2.name || 'Tim 2 (Belum Diisi)'}
                </div>
                <div className="text-[11px] text-[#6F7978] truncate">
                  {match.team2.players || '-'}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono text-base font-black text-[#006A6A] block">
                  {match.team2.score}
                </span>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-black/5 flex items-center justify-between">
              <span className="text-[10px] font-mono font-semibold uppercase">
                {match.team2.isWinner ? '🏆 PEMENANG RESMI' : 'Tim 2'}
              </span>
              <button
                type="button"
                onClick={() => handleToggleWinnerInline(roundType, index, 2)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  match.team2.isWinner
                    ? 'bg-[#006A6A] text-white'
                    : 'bg-white border border-[#D8DFDE] hover:border-[#006A6A] text-[#191C1C]'
                }`}
              >
                {match.team2.isWinner ? '✓ Juara / Lolos' : 'Pilih Pemenang'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold shadow-md flex items-center justify-between animate-in slide-in-from-top-2 duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : notification.type === 'info'
              ? 'bg-teal-50 border-teal-300 text-teal-900'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-bold underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Control Bar: Tournament Selector & Action Buttons */}
      <div className="p-6 rounded-3xl bg-white border border-[#D8DFDE] shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                SUPER ADMIN CONTROLLER
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#E6F4F2] text-[#006A6A] border border-[#006A6A]/30 text-[10px] font-mono font-bold uppercase">
                THEME-MATCHED KNOCKOUT TREE
              </span>
            </div>
            <h3 className="text-xl font-black text-[#191C1C] font-display">
              Manajemen Bagan Sistem Gugur (Knockout Bracket)
            </h3>
            <p className="text-xs text-[#6F7978]">
              Kelola peserta, skor, pemenang, nomor lapangan, dan waktu pertandingan untuk setiap babak.
              Perubahan langsung tersimpan ke sistem dan dapat dilihat oleh seluruh penonton.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleAutoAdvance}
              className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Secara otomatis memajukan tim pemenang dari Round of 16 ke QF, Semifinal, dan Grand Final"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Advance Pemenang</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              className="px-4 py-2 rounded-xl bg-[#006A6A] hover:bg-[#007A7C] text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#006A6A]/20"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Bracket</span>
            </button>

            <button
              type="button"
              onClick={handleResetBracket}
              className="px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-[#191C1C] font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer border border-[#D8DFDE]"
              title="Reset ke data awal turnamen"
            >
              <RotateCcw className="w-3.5 h-3.5 text-neutral-600" />
              <span>Reset Data</span>
            </button>
          </div>
        </div>

        {/* Tournament & Round Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[#D8DFDE]">
          <div>
            <label className="block text-[#6F7978] font-mono text-[11px] uppercase font-bold mb-1">
              Pilih Turnamen yang Dikelola:
            </label>
            <select
              value={selectedTournament}
              onChange={(e) => setSelectedTournament(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#D8DFDE] bg-[#F6FAF9] text-[#191C1C] font-semibold text-xs focus:outline-none focus:border-[#006A6A]"
            >
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.location}) · [{t.status}]
                </option>
              ))}
            </select>

            {/* Current Knockout Format Badge & Quick Switcher */}
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs bg-[#F6FAF9] border border-[#D8DFDE] p-2 rounded-xl">
              <div className="flex items-center gap-1.5">
                <span className="text-[#6F7978] font-mono text-[10px] font-bold uppercase">Format:</span>
                <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-white border border-[#D8DFDE] text-[#006A6A] shadow-2xs flex items-center gap-1">
                  {(!bracketData.roundOf16 || bracketData.roundOf16.length === 0) &&
                  (!bracketData.quarters || bracketData.quarters.length === 0) &&
                  (!bracketData.semis || bracketData.semis.length === 0) ? (
                    <>
                      <Crown className="w-3 h-3 text-amber-600" />
                      <span>Langsung Grand Final (Juara Pool)</span>
                    </>
                  ) : (!bracketData.roundOf16 || bracketData.roundOf16.length === 0) &&
                      (!bracketData.quarters || bracketData.quarters.length === 0) &&
                      bracketData.semis && bracketData.semis.length > 0 ? (
                    <>
                      <Flame className="w-3 h-3 text-purple-600" />
                      <span>Semifinal & Final</span>
                    </>
                  ) : bracketData.quarters && bracketData.quarters.length > 0 &&
                      (!bracketData.roundOf16 || bracketData.roundOf16.length === 0) ? (
                    <>
                      <Zap className="w-3 h-3 text-blue-600" />
                      <span>Perempat Final & Final</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3 h-3 text-purple-600" />
                      <span>16 Besar (Round of 16)</span>
                    </>
                  )}
                </span>
              </div>

              {/* Quick Format Switcher Buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSwitchKnockoutStage('final')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                    (!bracketData.roundOf16 || bracketData.roundOf16.length === 0) &&
                    (!bracketData.quarters || bracketData.quarters.length === 0) &&
                    (!bracketData.semis || bracketData.semis.length === 0)
                      ? 'bg-[#006A6A] text-white border-[#006A6A]'
                      : 'bg-white text-[#3D5A57] border-[#D8DFDE] hover:border-[#006A6A]'
                  }`}
                  title="Pemenang pool langsung bertanding di Grand Final tanpa Semifinal & Perempat Final"
                >
                  Direct Final
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchKnockoutStage('semis')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                    (!bracketData.roundOf16 || bracketData.roundOf16.length === 0) &&
                    (!bracketData.quarters || bracketData.quarters.length === 0) &&
                    bracketData.semis && bracketData.semis.length > 0
                      ? 'bg-[#006A6A] text-white border-[#006A6A]'
                      : 'bg-white text-[#3D5A57] border-[#D8DFDE] hover:border-[#006A6A]'
                  }`}
                  title="4 Tim bertanding di babak Semifinal & Grand Final"
                >
                  Semifinal
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchKnockoutStage('quarters')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                    bracketData.quarters && bracketData.quarters.length > 0 &&
                    (!bracketData.roundOf16 || bracketData.roundOf16.length === 0)
                      ? 'bg-[#006A6A] text-white border-[#006A6A]'
                      : 'bg-white text-[#3D5A57] border-[#D8DFDE] hover:border-[#006A6A]'
                  }`}
                  title="8 Tim bertanding di babak Perempat Final (QF)"
                >
                  Perempat Final
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[#6F7978] font-mono text-[11px] uppercase font-bold mb-1">
              Filter Tampilan Babak:
            </label>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveRoundTab('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeRoundTab === 'all'
                    ? 'bg-[#006A6A] text-white shadow-xs'
                    : 'bg-[#F6FAF9] text-[#3D5A57] border border-[#D8DFDE] hover:border-[#006A6A]'
                }`}
              >
                Semua
              </button>

              {/* Dynamic Pool Stage Buttons */}
              {tournamentPools.map((pName) => {
                const count = poolMatches.filter((m) => m.round.includes(pName) || m.round.toLowerCase().includes(pName.toLowerCase())).length;
                return (
                  <button
                    key={pName}
                    type="button"
                    onClick={() => setActiveRoundTab(`pool:${pName}`)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                      activeRoundTab === `pool:${pName}`
                        ? 'bg-[#006A6A] text-white shadow-xs'
                        : 'bg-[#F6FAF9] text-[#3D5A57] border border-[#D8DFDE] hover:border-[#006A6A]'
                    }`}
                  >
                    {pName} {count > 0 && `(${count})`}
                  </button>
                );
              })}

              {bracketData.roundOf16 && bracketData.roundOf16.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveRoundTab('roundOf16')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeRoundTab === 'roundOf16'
                      ? 'bg-[#006A6A] text-white shadow-xs'
                      : 'bg-[#F6FAF9] text-[#3D5A57] border border-[#D8DFDE] hover:border-[#006A6A]'
                  }`}
                >
                  Round of 16 ({bracketData.roundOf16.length})
                </button>
              )}
              {bracketData.quarters && bracketData.quarters.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveRoundTab('quarters')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeRoundTab === 'quarters'
                      ? 'bg-[#006A6A] text-white shadow-xs'
                      : 'bg-[#F6FAF9] text-[#3D5A57] border border-[#D8DFDE] hover:border-[#006A6A]'
                  }`}
                >
                  Perempat Final ({bracketData.quarters.length})
                </button>
              )}
              {bracketData.semis && bracketData.semis.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveRoundTab('semis')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeRoundTab === 'semis'
                      ? 'bg-[#006A6A] text-white shadow-xs'
                      : 'bg-[#F6FAF9] text-[#3D5A57] border border-[#D8DFDE] hover:border-[#006A6A]'
                  }`}
                >
                  Semifinal ({bracketData.semis.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveRoundTab('finals')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeRoundTab === 'finals'
                    ? 'bg-[#006A6A] text-white shadow-xs'
                    : 'bg-[#F6FAF9] text-[#3D5A57] border border-[#D8DFDE] hover:border-[#006A6A]'
                }`}
              >
                {bracketData.bronzeMatch ? 'Final & Juara 3 (2)' : 'Grand Final (1)'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* List of Match Cards for Super Admin to Edit */}
      <div className="space-y-6">
        {/* POOL STAGE MATCHES SECTION */}
        {tournamentPools.map((pName) => {
          const matchesInPool = poolMatches.filter(
            (m) => m.round.includes(pName) || m.round.toLowerCase().includes(pName.toLowerCase())
          );
          const isPoolActive = activeRoundTab === 'all' || activeRoundTab === `pool:${pName}`;
          if (!isPoolActive) return null;

          const finishedCount = matchesInPool.filter((m) => m.status === 'Selesai').length;
          const scheduledCount = matchesInPool.filter((m) => m.status === 'Dijadwalkan').length;
          const liveCount = matchesInPool.filter((m) => m.status === 'Live').length;

          return (
            <div key={pName} className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-sm font-bold text-[#006A6A] flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#006A6A]" />
                  <span>Babak Penyisihan Grup — {pName} ({matchesInPool.length} Pertandingan)</span>
                </h4>
                <div className="flex items-center gap-2 text-xs font-mono">
                  {finishedCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                      ✓ {finishedCount} Selesai (Terlaksana)
                    </span>
                  )}
                  {scheduledCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-md bg-neutral-100 text-neutral-600 font-bold border border-neutral-200">
                      🕒 {scheduledCount} Dijadwalkan
                    </span>
                  )}
                  {liveCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-md bg-red-50 text-red-600 font-bold border border-red-200 animate-pulse">
                      ● {liveCount} Live
                    </span>
                  )}
                </div>
              </div>

              {matchesInPool.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-white border border-[#D8DFDE] text-xs text-[#6F7978]">
                  Belum ada pertandingan untuk {pName}. Jadwal pertandingan akan dibuat otomatis dari pasangan peserta pool.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {matchesInPool.map((m) => renderPoolMatchRow(m, pName))}
                </div>
              )}
            </div>
          );
        })}
        {/* ROUND OF 16 SECTION */}
        {bracketData.roundOf16 && bracketData.roundOf16.length > 0 && (activeRoundTab === 'all' || activeRoundTab === 'roundOf16') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[#191C1C] flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#006A6A]" />
                <span>Round of 16 (Babak 16 Besar - {bracketData.roundOf16.length} Pertandingan)</span>
              </h4>
              <span className="text-xs text-[#6F7978] font-mono">
                {bracketData.roundOf16.length} Pertandingan
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bracketData.roundOf16.map((m, idx) => renderMatchRow(m, 'roundOf16', idx))}
            </div>
          </div>
        )}

        {/* QUARTER FINALS SECTION */}
        {bracketData.quarters && bracketData.quarters.length > 0 && (activeRoundTab === 'all' || activeRoundTab === 'quarters') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[#191C1C] flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#006A6A]" />
                <span>Quarter Finals (Perempat Final - 4 Pertandingan)</span>
              </h4>
              <span className="text-xs text-[#6F7978] font-mono">
                {bracketData.quarters.length} Pertandingan
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bracketData.quarters.map((m, idx) => renderMatchRow(m, 'quarters', idx))}
            </div>
          </div>
        )}

        {/* SEMI FINALS SECTION */}
        {bracketData.semis && bracketData.semis.length > 0 && (activeRoundTab === 'all' || activeRoundTab === 'semis') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[#6E4D8B] flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#6E4D8B]" />
                <span>Semi Finals (Semifinal - {bracketData.semis.length} Pertandingan)</span>
              </h4>
              <span className="text-xs text-[#6F7978] font-mono">
                {bracketData.semis.length} Pertandingan
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bracketData.semis.map((m, idx) => renderMatchRow(m, 'semis', idx))}
            </div>
          </div>
        )}

        {/* FINALS SECTION */}
        {(activeRoundTab === 'all' || activeRoundTab === 'finals') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[#854D0E] flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-600" />
                <span>Puncak Penentuan: Grand Final {bracketData.bronzeMatch ? '& Perebutan Juara 3' : ''}</span>
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderMatchRow(bracketData.grandFinal, 'grandFinal')}
              {bracketData.bronzeMatch && renderMatchRow(bracketData.bronzeMatch, 'bronzeMatch')}
            </div>
          </div>
        )}
      </div>

      {/* LIVE PREVIEW SECTION: Knockout Bracket Visualizer with Real-time theme styling */}
      <div className="p-6 rounded-3xl bg-white border border-[#D8DFDE] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h4 className="text-base font-black text-[#191C1C] flex items-center gap-2 font-display">
              <Eye className="w-4 h-4 text-[#006A6A]" />
              <span>Preview Visual Bagan Sistem Gugur (Warna Tema Resmi)</span>
            </h4>
            <p className="text-xs text-[#6F7978]">
              Inilah tampilan yang akan langsung dilihat oleh pengunjung turnamen di halaman tamu.
              Klik kartu mana pun untuk langsung membuka formulir pengeditan.
            </p>
          </div>

          <span className="text-xs font-mono text-[#006A6A] bg-[#E6F4F2] px-3 py-1 rounded-lg font-bold border border-[#006A6A]/20">
            Interactive Admin Click-to-Edit
          </span>
        </div>

        {/* Live Visualizer with theme matching */}
        <KnockoutBracketVisualizer
          roundOf16={bracketData.roundOf16}
          quarters={bracketData.quarters}
          semis={bracketData.semis}
          grandFinal={bracketData.grandFinal}
          bronzeMatch={bracketData.bronzeMatch}
          tournamentName={tournaments.find((t) => t.id === selectedTournament)?.name || 'Turnamen Padel'}
          isAdminMode={true}
          onEditMatch={(m, rType) => {
            // Find index if array
            let idx: number | undefined = undefined;
            if (rType === 'roundOf16' && bracketData.roundOf16) {
              idx = bracketData.roundOf16.findIndex((item) => item.id === m.id);
            } else if (rType === 'quarters') {
              idx = bracketData.quarters.findIndex((item) => item.id === m.id);
            } else if (rType === 'semis') {
              idx = bracketData.semis.findIndex((item) => item.id === m.id);
            }
            handleOpenEditMatch(
              m,
              rType as 'roundOf16' | 'quarters' | 'semis' | 'grandFinal' | 'bronzeMatch',
              idx !== -1 ? idx : undefined
            );
          }}
        />
      </div>

      {/* EDIT MATCH MODAL FOR SUPER ADMIN */}
      {editingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="max-w-lg w-full bg-white rounded-3xl border border-[#D8DFDE] p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DFDE]">
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono uppercase text-[#006A6A] font-bold tracking-wider">
                  Super Admin Form
                </span>
                <h4 className="text-lg font-black text-[#191C1C] font-display">
                  Edit Pertandingan: {editingMatch.match.roundTitle}
                </h4>
              </div>
              <button
                onClick={() => setEditingMatch(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Match Meta: Court, Time, Status */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[#6F7978] font-mono text-[10px] uppercase font-bold mb-1">
                  Lapangan (Court):
                </label>
                <select
                  value={editingMatch.match.court}
                  onChange={(e) =>
                    setEditingMatch({
                      ...editingMatch,
                      match: { ...editingMatch.match, court: e.target.value }
                    })
                  }
                  className="w-full px-2.5 py-2 rounded-xl border border-[#D8DFDE] bg-[#F6FAF9] font-bold text-[#191C1C]"
                >
                  <option value="COURT #1">COURT #1</option>
                  <option value="COURT #2">COURT #2</option>
                  <option value="COURT #3">COURT #3</option>
                  <option value="COURT #4">COURT #4</option>
                  <option value="COURT #5">COURT #5</option>
                  <option value="COURT #6">COURT #6</option>
                  <option value="All In Padel Court 1">All In Padel Court 1</option>
                </select>
              </div>

              <div>
                <label className="block text-[#6F7978] font-mono text-[10px] uppercase font-bold mb-1">
                  Jam Tanding:
                </label>
                <input
                  type="text"
                  value={editingMatch.match.time}
                  onChange={(e) =>
                    setEditingMatch({
                      ...editingMatch,
                      match: { ...editingMatch.match, time: e.target.value }
                    })
                  }
                  placeholder="14:30"
                  className="w-full px-2.5 py-2 rounded-xl border border-[#D8DFDE] bg-[#F6FAF9] font-mono font-bold text-[#191C1C]"
                />
              </div>

              <div>
                <label className="block text-[#6F7978] font-mono text-[10px] uppercase font-bold mb-1">
                  Status:
                </label>
                <select
                  value={editingMatch.match.status}
                  onChange={(e) =>
                    setEditingMatch({
                      ...editingMatch,
                      match: {
                        ...editingMatch.match,
                        status: e.target.value as 'Selesai' | 'Live' | 'Dijadwalkan'
                      }
                    })
                  }
                  className="w-full px-2.5 py-2 rounded-xl border border-[#D8DFDE] bg-[#F6FAF9] font-bold text-[#191C1C]"
                >
                  <option value="Selesai">Selesai (Finished)</option>
                  <option value="Live">Live (Sedang Main)</option>
                  <option value="Dijadwalkan">Dijadwalkan</option>
                </select>
              </div>
            </div>

            {/* Team 1 Details */}
            {/* Team 1 Details */}
            {(() => {
              const dropdown1 = getParticipantDropdownGroups(1);
              return (
                <div className="p-4 rounded-2xl bg-[#F6FAF9] border border-[#D8DFDE] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-[#006A6A] uppercase">
                      Data Tim 1 (Atas):
                    </span>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-[#191C1C] cursor-pointer">
                      <input
                        type="radio"
                        name="winner_radio"
                        checked={editingMatch.match.team1.isWinner}
                        onChange={() =>
                          setEditingMatch({
                            ...editingMatch,
                            match: {
                              ...editingMatch.match,
                              team1: { ...editingMatch.match.team1, isWinner: true },
                              team2: { ...editingMatch.match.team2, isWinner: false },
                              status: 'Selesai'
                            }
                          })
                        }
                        className="w-4 h-4 text-[#006A6A]"
                      />
                      <span>Pemenang (Winner)</span>
                    </label>
                  </div>

                  {/* Dropdown Pemilihan Pasangan Tim 1 */}
                  <div>
                    <label className="block text-[#006A6A] font-mono text-[10px] uppercase font-bold mb-1 flex items-center justify-between">
                      <span>Pilih Pasangan dari Pool / Peserta:</span>
                      <span className="text-[9px] font-normal text-[#6F7978] lowercase">(klik untuk pilih instan)</span>
                    </label>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        try {
                          const item = JSON.parse(e.target.value);
                          setEditingMatch({
                            ...editingMatch,
                            match: {
                              ...editingMatch.match,
                              team1: {
                                ...editingMatch.match.team1,
                                name: item.name,
                                players: item.players || 'TBD'
                              }
                            }
                          });
                        } catch (err) {}
                      }}
                      className="w-full px-2.5 py-2 rounded-xl border border-[#006A6A]/30 bg-white font-semibold text-xs text-[#191C1C] focus:outline-none focus:border-[#006A6A] focus:ring-1 focus:ring-[#006A6A] shadow-2xs"
                    >
                      <option value="">-- Pilih dari Daftar Pasangan Peserta / Babak --</option>
                      {dropdown1.recommendations.length > 0 && (
                        <optgroup label="⭐ Rekomendasi Sesuai Babak & Pool Ini">
                          {dropdown1.recommendations.map((r, idx) => (
                            <option key={`rec1-${idx}`} value={JSON.stringify({ name: r.name, players: r.players })}>
                              {r.label}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {dropdown1.knockoutWinners.length > 0 && (
                        <optgroup label="🏆 Pemenang Babak Knockout Sebelumnya">
                          {dropdown1.knockoutWinners.map((w, idx) => (
                            <option key={`w1-${idx}`} value={JSON.stringify({ name: w.name, players: w.players })}>
                              {w.label}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {dropdown1.poolGroups.map((pg) => (
                        <optgroup key={`pg1-${pg.poolName}`} label={`🏸 Pasangan Peserta ${pg.poolName} (${pg.teams.length} Tim)`}>
                          {pg.teams.map((t, idx) => (
                            <option key={`t1-${pg.poolName}-${idx}`} value={JSON.stringify({ name: t.name, players: t.players })}>
                              {t.name} ({pg.poolName} {t.seed ? `· Seed ${t.seed}` : ''})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                      <optgroup label="📝 Format Standar / Placeholder">
                        {dropdown1.placeholders.map((p, idx) => (
                          <option key={`pl1-${idx}`} value={JSON.stringify({ name: p.name, players: p.players })}>
                            {p.label}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="col-span-2">
                      <label className="block text-[#6F7978] text-[10px] mb-1">Nama Pasangan Tim:</label>
                      <input
                        type="text"
                        value={editingMatch.match.team1.name}
                        onChange={(e) =>
                          setEditingMatch({
                            ...editingMatch,
                            match: {
                              ...editingMatch.match,
                              team1: { ...editingMatch.match.team1, name: e.target.value }
                            }
                          })
                        }
                        placeholder="Contoh: Merry & Fifi"
                        className="w-full px-3 py-1.5 rounded-xl border border-[#D8DFDE] bg-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[#6F7978] text-[10px] mb-1">Skor:</label>
                      <input
                        type="text"
                        value={editingMatch.match.team1.score}
                        onChange={(e) =>
                          setEditingMatch({
                            ...editingMatch,
                            match: {
                              ...editingMatch.match,
                              team1: { ...editingMatch.match.team1, score: e.target.value }
                            }
                          })
                        }
                        placeholder="4"
                        className="w-full px-3 py-1.5 rounded-xl border border-[#D8DFDE] bg-white font-mono font-black text-center text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#6F7978] text-[10px] mb-1">Nama Pemain Detail:</label>
                    <input
                      type="text"
                      value={editingMatch.match.team1.players}
                      onChange={(e) =>
                        setEditingMatch({
                          ...editingMatch,
                          match: {
                            ...editingMatch.match,
                            team1: { ...editingMatch.match.team1, players: e.target.value }
                          }
                        })
                      }
                      placeholder="Merry / Fifi"
                      className="w-full px-3 py-1.5 rounded-xl border border-[#D8DFDE] bg-white text-xs"
                    />
                  </div>
                </div>
              );
            })()}

            {/* Team 2 Details */}
            {(() => {
              const dropdown2 = getParticipantDropdownGroups(2);
              return (
                <div className="p-4 rounded-2xl bg-[#F6FAF9] border border-[#D8DFDE] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-[#006A6A] uppercase">
                      Data Tim 2 (Bawah):
                    </span>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-[#191C1C] cursor-pointer">
                      <input
                        type="radio"
                        name="winner_radio"
                        checked={editingMatch.match.team2.isWinner}
                        onChange={() =>
                          setEditingMatch({
                            ...editingMatch,
                            match: {
                              ...editingMatch.match,
                              team1: { ...editingMatch.match.team1, isWinner: false },
                              team2: { ...editingMatch.match.team2, isWinner: true },
                              status: 'Selesai'
                            }
                          })
                        }
                        className="w-4 h-4 text-[#006A6A]"
                      />
                      <span>Pemenang (Winner)</span>
                    </label>
                  </div>

                  {/* Dropdown Pemilihan Pasangan Tim 2 */}
                  <div>
                    <label className="block text-[#006A6A] font-mono text-[10px] uppercase font-bold mb-1 flex items-center justify-between">
                      <span>Pilih Pasangan dari Pool / Peserta:</span>
                      <span className="text-[9px] font-normal text-[#6F7978] lowercase">(klik untuk pilih instan)</span>
                    </label>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        try {
                          const item = JSON.parse(e.target.value);
                          setEditingMatch({
                            ...editingMatch,
                            match: {
                              ...editingMatch.match,
                              team2: {
                                ...editingMatch.match.team2,
                                name: item.name,
                                players: item.players || 'TBD'
                              }
                            }
                          });
                        } catch (err) {}
                      }}
                      className="w-full px-2.5 py-2 rounded-xl border border-[#006A6A]/30 bg-white font-semibold text-xs text-[#191C1C] focus:outline-none focus:border-[#006A6A] focus:ring-1 focus:ring-[#006A6A] shadow-2xs"
                    >
                      <option value="">-- Pilih dari Daftar Pasangan Peserta / Babak --</option>
                      {dropdown2.recommendations.length > 0 && (
                        <optgroup label="⭐ Rekomendasi Sesuai Babak & Pool Ini">
                          {dropdown2.recommendations.map((r, idx) => (
                            <option key={`rec2-${idx}`} value={JSON.stringify({ name: r.name, players: r.players })}>
                              {r.label}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {dropdown2.knockoutWinners.length > 0 && (
                        <optgroup label="🏆 Pemenang Babak Knockout Sebelumnya">
                          {dropdown2.knockoutWinners.map((w, idx) => (
                            <option key={`w2-${idx}`} value={JSON.stringify({ name: w.name, players: w.players })}>
                              {w.label}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {dropdown2.poolGroups.map((pg) => (
                        <optgroup key={`pg2-${pg.poolName}`} label={`🏸 Pasangan Peserta ${pg.poolName} (${pg.teams.length} Tim)`}>
                          {pg.teams.map((t, idx) => (
                            <option key={`t2-${pg.poolName}-${idx}`} value={JSON.stringify({ name: t.name, players: t.players })}>
                              {t.name} ({pg.poolName} {t.seed ? `· Seed ${t.seed}` : ''})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                      <optgroup label="📝 Format Standar / Placeholder">
                        {dropdown2.placeholders.map((p, idx) => (
                          <option key={`pl2-${idx}`} value={JSON.stringify({ name: p.name, players: p.players })}>
                            {p.label}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="col-span-2">
                      <label className="block text-[#6F7978] text-[10px] mb-1">Nama Pasangan Tim:</label>
                      <input
                        type="text"
                        value={editingMatch.match.team2.name}
                        onChange={(e) =>
                          setEditingMatch({
                            ...editingMatch,
                            match: {
                              ...editingMatch.match,
                              team2: { ...editingMatch.match.team2, name: e.target.value }
                            }
                          })
                        }
                        placeholder="Contoh: Ari & Monaria"
                        className="w-full px-3 py-1.5 rounded-xl border border-[#D8DFDE] bg-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[#6F7978] text-[10px] mb-1">Skor:</label>
                      <input
                        type="text"
                        value={editingMatch.match.team2.score}
                        onChange={(e) =>
                          setEditingMatch({
                            ...editingMatch,
                            match: {
                              ...editingMatch.match,
                              team2: { ...editingMatch.match.team2, score: e.target.value }
                            }
                          })
                        }
                        placeholder="3"
                        className="w-full px-3 py-1.5 rounded-xl border border-[#D8DFDE] bg-white font-mono font-black text-center text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#6F7978] text-[10px] mb-1">Nama Pemain Detail:</label>
                    <input
                      type="text"
                      value={editingMatch.match.team2.players}
                      onChange={(e) =>
                        setEditingMatch({
                          ...editingMatch,
                          match: {
                            ...editingMatch.match,
                            team2: { ...editingMatch.match.team2, players: e.target.value }
                          }
                        })
                      }
                      placeholder="Ari / Monaria"
                      className="w-full px-3 py-1.5 rounded-xl border border-[#D8DFDE] bg-white text-xs"
                    />
                  </div>
                </div>
              );
            })()}

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingMatch(null)}
                className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveMatchEdit}
                className="px-5 py-2 rounded-xl bg-[#006A6A] hover:bg-[#007A7C] text-white text-xs font-bold transition-all shadow-md shadow-[#006A6A]/20 cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Simpan Perubahan Pertandingan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
