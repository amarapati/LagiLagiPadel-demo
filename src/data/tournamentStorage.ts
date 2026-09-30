import { PADEL_TOURNAMENTS_DATA, FullTournamentDetail, TournamentMatch, TournamentWinner, PoolTeamStanding } from './padelProTournamentsData';
import { apiSaveTournament, apiDeleteTournament, apiUpdateTournamentStatus, apiResetSystem, apiFetchTournaments } from './apiClient';

const TOURNAMENTS_STORAGE_KEY = 'lagilagipadel_custom_tournaments';

// Trigger initial load from server API on module load
if (typeof window !== 'undefined') {
  apiFetchTournaments().catch(() => {});
}

/**
 * Initializes and retrieves tournaments from persistent local storage.
 * Seeds with default predefined tournaments if storage is empty.
 */
export const getStoredTournaments = (): FullTournamentDetail[] => {
  try {
    const raw = localStorage.getItem(TOURNAMENTS_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading stored tournaments:', err);
  }

  // When initial/fresh load with no stored data, return empty array (clean slate)
  return [];
};

/**
 * Empties all tournaments (0 tournaments).
 */
export const clearAllTournaments = (): void => {
  try {
    localStorage.setItem(TOURNAMENTS_STORAGE_KEY, JSON.stringify([]));
  } catch (e) {
    console.error(e);
  }
  apiResetSystem(true).catch(() => {});
  window.dispatchEvent(
    new CustomEvent('lagilagipadel_tournaments_updated', {
      detail: { tournaments: [] }
    })
  );
};

/**
 * Retrieves a single tournament by its ID.
 */
export const getStoredTournamentById = (id: string): FullTournamentDetail | undefined => {
  const all = getStoredTournaments();
  return all.find((t) => t.id === id);
};

/**
 * Saves (creates or updates) a tournament.
 */
export const saveTournament = (tournament: FullTournamentDetail): void => {
  const current = getStoredTournaments();
  const existingIndex = current.findIndex((t) => t.id === tournament.id);

  let updated: FullTournamentDetail[];
  if (existingIndex >= 0) {
    // Preserve existing rich data (participants, bracket, matches) if not supplied in edit
    const existing = current[existingIndex];
    updated = [...current];
    updated[existingIndex] = {
      ...existing,
      ...tournament,
      // Ensure complex objects aren't wiped out if absent
      winners: tournament.winners || existing.winners,
      participants: tournament.participants || existing.participants,
      matches: tournament.matches || existing.matches,
      knockoutBracket: tournament.knockoutBracket || existing.knockoutBracket,
      groupStandings: tournament.groupStandings || existing.groupStandings
    };
  } else {
    // New tournament: ensure complete sub-structures exist
    const newTournament: FullTournamentDetail = {
      ...tournament,
      winners: tournament.winners || {
        notes: `Turnamen ${tournament.name} belum memiliki pemenang resmi.`,
        podium: []
      },
      participants: tournament.participants || [],
      matches: tournament.matches || [],
      knockoutBracket: tournament.knockoutBracket || {
        quarters: [
          {
            id: 'qf-1',
            roundTitle: 'Perempat Final 1',
            court: 'Court 1',
            time: '13:00',
            team1: { name: 'Menunggu Tim (Juara Pool A)', players: 'Pemain 1 / Pemain 2', score: '-', isWinner: false },
            team2: { name: 'Menunggu Tim (Runner-up Pool B)', players: 'Pemain 1 / Pemain 2', score: '-', isWinner: false },
            status: 'Dijadwalkan'
          },
          {
            id: 'qf-2',
            roundTitle: 'Perempat Final 2',
            court: 'Court 2',
            time: '13:45',
            team1: { name: 'Menunggu Tim (Juara Pool B)', players: 'Pemain 1 / Pemain 2', score: '-', isWinner: false },
            team2: { name: 'Menunggu Tim (Runner-up Pool A)', players: 'Pemain 1 / Pemain 2', score: '-', isWinner: false },
            status: 'Dijadwalkan'
          }
        ],
        semis: [
          {
            id: 'sf-1',
            roundTitle: 'Semifinal 1',
            court: 'Court 1',
            time: '15:30',
            team1: { name: 'Pemenang QF 1', players: 'TBD', score: '-', isWinner: false },
            team2: { name: 'Pemenang QF 2', players: 'TBD', score: '-', isWinner: false },
            status: 'Dijadwalkan'
          }
        ],
        grandFinal: {
          id: 'gf-1',
          roundTitle: 'Grand Final (Gold Match)',
          court: 'Court 1',
          time: '17:00',
          team1: { name: 'Finalis 1', players: 'TBD', score: '-', isWinner: false },
          team2: { name: 'Finalis 2', players: 'TBD', score: '-', isWinner: false },
          status: 'Dijadwalkan'
        },
        bronzeMatch: {
          id: 'bm-1',
          roundTitle: 'Perebutan Tempat ke-3 (Bronze)',
          court: 'Court 2',
          time: '16:15',
          team1: { name: 'Semifinalis 1', players: 'TBD', score: '-', isWinner: false },
          team2: { name: 'Semifinalis 2', players: 'TBD', score: '-', isWinner: false },
          status: 'Dijadwalkan'
        }
      },
      groupStandings: tournament.groupStandings || {
        pools: ['Semua Pool', 'Pool A', 'Pool B'],
        standings: []
      }
    };
    updated = [newTournament, ...current];
  }

  try {
    localStorage.setItem(TOURNAMENTS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error saving tournament:', err);
  }

  // Persist to centralized SQLite server
  apiSaveTournament(updated[existingIndex >= 0 ? existingIndex : 0]).catch((err) => {
    console.warn('[Sync] Server save error:', err);
  });

  window.dispatchEvent(
    new CustomEvent('lagilagipadel_tournaments_updated', {
      detail: { tournaments: updated, affectedId: tournament.id }
    })
  );
};

/**
 * Updates only the status of an existing tournament quickly.
 */
export const updateTournamentStatus = (
  id: string,
  status: 'Live' | 'Selesai' | 'Akan Datang'
): void => {
  const current = getStoredTournaments();
  const index = current.findIndex((t) => t.id === id);
  if (index === -1) return;

  current[index].status = status;

  try {
    localStorage.setItem(TOURNAMENTS_STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.error('Error updating tournament status:', err);
  }

  // Centralized SQLite status sync
  apiUpdateTournamentStatus(id, status).catch((err) => {
    console.warn('[Sync] Server status error:', err);
  });

  window.dispatchEvent(
    new CustomEvent('lagilagipadel_tournaments_updated', {
      detail: { tournaments: current, affectedId: id }
    })
  );
};

/**
 * Deletes a tournament by its ID.
 */
export const deleteTournament = (id: string): void => {
  const current = getStoredTournaments();
  const updated = current.filter((t) => t.id !== id);

  try {
    localStorage.setItem(TOURNAMENTS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error deleting tournament:', err);
  }

  // Centralized SQLite deletion
  apiDeleteTournament(id).catch((err) => {
    console.warn('[Sync] Server delete error:', err);
  });

  window.dispatchEvent(
    new CustomEvent('lagilagipadel_tournaments_updated', {
      detail: { tournaments: updated, affectedId: id, deleted: true }
    })
  );
};

/**
 * Resets tournament list back to system default.
 */
export const resetToDefaultTournaments = (): FullTournamentDetail[] => {
  const defaultList = Object.values(PADEL_TOURNAMENTS_DATA);
  try {
    localStorage.setItem(TOURNAMENTS_STORAGE_KEY, JSON.stringify(defaultList));
  } catch (e) {
    console.error(e);
  }
  window.dispatchEvent(
    new CustomEvent('lagilagipadel_tournaments_updated', {
      detail: { tournaments: defaultList }
    })
  );
  return defaultList;
};

/**
 * Real-time synchronization of a referee live match into the tournament's matches list.
 * Auto-marks the tournament status as 'Live' and dispatches update event to guest viewers.
 */
export const syncLiveMatchScore = (
  tournamentId: string,
  courtNumber: number,
  matchPhase: string,
  teamAName: string,
  teamBName: string,
  scoreA: string,
  scoreB: string,
  setDetail: string
): void => {
  const allTournaments = getStoredTournaments();
  const index = allTournaments.findIndex((t) => t.id === tournamentId);
  if (index === -1) return;

  const tourney = allTournaments[index];
  const matchId = `live-${tournamentId}-c${courtNumber}`;
  const existingMatches = tourney.matches || [];

  const roundCategory: 'final' | 'knockout' | 'grup' = matchPhase.toLowerCase().includes('final')
    ? 'final'
    : matchPhase.toLowerCase().includes('semi') || matchPhase.toLowerCase().includes('quarter') || matchPhase.toLowerCase().includes('perempat')
    ? 'knockout'
    : 'grup';

  const updatedMatch: TournamentMatch = {
    id: matchId,
    round: `${matchPhase} (Court ${courtNumber})`,
    roundCategory,
    court: `Court ${courtNumber}`,
    time: 'Sedang Berlangsung (Live)',
    teamA: teamAName,
    playersA: teamAName,
    teamB: teamBName,
    playersB: teamBName,
    scoreA,
    scoreB,
    setDetail,
    winner: 'live',
    status: 'Live'
  };

  // Replace existing match on this court or prepend
  const otherMatches = existingMatches.filter(
    (m) => m.id !== matchId && m.court !== `Court ${courtNumber}`
  );

  const updatedTournament: FullTournamentDetail = {
    ...tourney,
    status: 'Live',
    liveCourtNumber: courtNumber,
    matches: [updatedMatch, ...otherMatches]
  };

  allTournaments[index] = updatedTournament;

  try {
    localStorage.setItem(TOURNAMENTS_STORAGE_KEY, JSON.stringify(allTournaments));
  } catch (err) {
    console.error('Error syncing live match score:', err);
  }

  window.dispatchEvent(
    new CustomEvent('lagilagipadel_tournaments_updated', {
      detail: { tournaments: allTournaments, affectedId: tournamentId, liveUpdate: true }
    })
  );
};

/**
 * Finishes a match officially and publishes it to the guest system.
 * Updates match status to 'Selesai', records winners, and updates tournament podium if Grand Final.
 */
export const finishAndPublishMatch = (
  tournamentId: string,
  courtNumber: number,
  matchPhase: string,
  teamAName: string,
  teamBName: string,
  finalScoreA: string,
  finalScoreB: string,
  setDetail: string,
  winnerChoice: 'A' | 'B'
): { updatedTournament: FullTournamentDetail; isGrandFinal: boolean } => {
  const allTournaments = getStoredTournaments();
  const index = allTournaments.findIndex((t) => t.id === tournamentId);
  if (index === -1) {
    throw new Error('Tournament not found');
  }

  const tourney = allTournaments[index];
  const matchId = `finished-${tournamentId}-${Date.now()}`;
  const liveMatchId = `live-${tournamentId}-c${courtNumber}`;
  const existingMatches = tourney.matches || [];

  const winnerName = winnerChoice === 'A' ? teamAName : teamBName;
  const loserName = winnerChoice === 'A' ? teamBName : teamAName;

  const roundCategory: 'final' | 'knockout' | 'grup' = matchPhase.toLowerCase().includes('final')
    ? 'final'
    : matchPhase.toLowerCase().includes('semi') || matchPhase.toLowerCase().includes('quarter') || matchPhase.toLowerCase().includes('perempat')
    ? 'knockout'
    : 'grup';

  const finishedMatch: TournamentMatch = {
    id: matchId,
    round: `${matchPhase} (Court ${courtNumber})`,
    roundCategory,
    court: `Court ${courtNumber}`,
    time: 'Selesai',
    teamA: teamAName,
    playersA: teamAName,
    teamB: teamBName,
    playersB: teamBName,
    scoreA: finalScoreA,
    scoreB: finalScoreB,
    setDetail: `${setDetail} · Pemenang: ${winnerName} 🏆`,
    winner: winnerChoice,
    status: 'Selesai'
  };

  // Replace any previous live match on this court
  const cleanMatches = existingMatches.filter(
    (m) => m.id !== liveMatchId && !(m.court === `Court ${courtNumber}` && m.status === 'Live')
  );

  const updatedMatches = [finishedMatch, ...cleanMatches];

  // Check if it's Grand Final to update podium
  const isGrandFinal =
    matchPhase.toLowerCase().includes('grand final') ||
    (matchPhase.toLowerCase().includes('final') && !matchPhase.toLowerCase().includes('semi') && !matchPhase.toLowerCase().includes('perempat') && !matchPhase.toLowerCase().includes('quarter') && !matchPhase.toLowerCase().includes('3'));

  const isBronze = matchPhase.toLowerCase().includes('3') || matchPhase.toLowerCase().includes('bronze');

  let updatedWinners = { ...tourney.winners };

  if (isGrandFinal) {
    const existingPodium = updatedWinners.podium || [];
    const podiumFiltered = existingPodium.filter((p) => p.place !== '1' && p.place !== '2');

    const goldPodium: TournamentWinner = {
      place: '1',
      title: 'JUARA 1 (GOLD)',
      badgeColor: 'bg-amber-400',
      teamName: winnerName,
      p1: winnerName.split('&')[0]?.trim() || winnerName,
      p2: winnerName.split('&')[1]?.trim() || winnerName,
      club: 'LagiLagiPadel Club',
      prize: 'Rp 15.000.000 + Golden Cup Trophy',
      trophy: '🏆 Golden Trophy FIP',
      finalScore: `${finalScoreA} - ${finalScoreB}`,
      pointsEarned: 1000
    };

    const silverPodium: TournamentWinner = {
      place: '2',
      title: 'JUARA 2 (SILVER)',
      badgeColor: 'bg-neutral-300',
      teamName: loserName,
      p1: loserName.split('&')[0]?.trim() || loserName,
      p2: loserName.split('&')[1]?.trim() || loserName,
      club: 'LagiLagiPadel Club',
      prize: 'Rp 8.000.000 + Silver Plate',
      trophy: '🥈 Silver Trophy',
      finalScore: `${finalScoreA} - ${finalScoreB}`,
      pointsEarned: 600
    };

    updatedWinners = {
      ...updatedWinners,
      notes: `Grand Final resmi berakhir! Tim ${winnerName} dinobatkan sebagai Juara 1 (Gold) setelah mengalahkan ${loserName}.`,
      podium: [goldPodium, silverPodium, ...podiumFiltered]
    };
  } else if (isBronze) {
    const existingPodium = updatedWinners.podium || [];
    const podiumFiltered = existingPodium.filter((p) => p.place !== '3');

    const bronzePodium: TournamentWinner = {
      place: '3',
      title: 'JUARA 3 (BRONZE)',
      badgeColor: 'bg-amber-700',
      teamName: winnerName,
      p1: winnerName.split('&')[0]?.trim() || winnerName,
      p2: winnerName.split('&')[1]?.trim() || winnerName,
      club: 'LagiLagiPadel Club',
      prize: 'Rp 4.000.000 + Bronze Medal',
      trophy: '🥉 Bronze Trophy',
      finalScore: `${finalScoreA} - ${finalScoreB}`,
      pointsEarned: 350
    };

    updatedWinners = {
      ...updatedWinners,
      podium: [...podiumFiltered, bronzePodium]
    };
  }

  // Update groupStandings and participants if this is a Pool / Grup match
  let updatedGroupStandings = tourney.groupStandings;
  let updatedParticipants = tourney.participants;

  if (roundCategory === 'grup' && updatedGroupStandings?.standings) {
    const numScoreA = parseInt(finalScoreA, 10) || 0;
    const numScoreB = parseInt(finalScoreB, 10) || 0;
    const normA = teamAName.trim().toLowerCase();
    const normB = teamBName.trim().toLowerCase();

    const updatedRows = updatedGroupStandings.standings.map((st) => {
      const stNorm = st.name.trim().toLowerCase();
      if (stNorm === normA) {
        const won = (st.won || 0) + (winnerChoice === 'A' ? 1 : 0);
        const lost = (st.lost || 0) + (winnerChoice === 'B' ? 1 : 0);
        const gamesWon = (st.gamesWon || 0) + numScoreA;
        const gamesLost = (st.gamesLost || 0) + numScoreB;
        return {
          ...st,
          played: (st.played || 0) + 1,
          won,
          lost,
          gamesWon,
          gamesLost,
          gameDiff: gamesWon - gamesLost,
          points: won * 2
        };
      }
      if (stNorm === normB) {
        const won = (st.won || 0) + (winnerChoice === 'B' ? 1 : 0);
        const lost = (st.lost || 0) + (winnerChoice === 'A' ? 1 : 0);
        const gamesWon = (st.gamesWon || 0) + numScoreB;
        const gamesLost = (st.gamesLost || 0) + numScoreA;
        return {
          ...st,
          played: (st.played || 0) + 1,
          won,
          lost,
          gamesWon,
          gamesLost,
          gameDiff: gamesWon - gamesLost,
          points: won * 2
        };
      }
      return st;
    });

    // Re-rank teams per pool and mark Top 2 who have played >= 1 match as isQualified
    const poolList = updatedGroupStandings.pools.filter((p) => p !== 'Semua Pool');
    const rankedStandings: typeof updatedRows = [];
    poolList.forEach((pName) => {
      const poolTeams = updatedRows
        .filter((r) => r.pool === pName)
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
          return (b.gamesWon || 0) - (a.gamesWon || 0);
        })
        .map((r, idx) => ({
          ...r,
          pos: idx + 1,
          isQualified: (r.played || 0) > 0 && idx < 2
        }));
      rankedStandings.push(...poolTeams);
    });

    updatedGroupStandings = {
      ...updatedGroupStandings,
      standings: rankedStandings.length > 0 ? rankedStandings : updatedRows
    };

    const qualifiedNames = new Set(
      updatedGroupStandings.standings.filter((s) => s.isQualified).map((s) => s.name.trim().toLowerCase())
    );
    updatedParticipants = (tourney.participants || []).map((p) => ({
      ...p,
      status: qualifiedNames.has(p.teamName.trim().toLowerCase()) ? 'Playoff' : 'Confirmed'
    }));
  }

  const updatedTournament: FullTournamentDetail = {
    ...tourney,
    status: isGrandFinal ? 'Selesai' : tourney.status,
    matches: updatedMatches,
    winners: updatedWinners,
    groupStandings: updatedGroupStandings,
    participants: updatedParticipants
  };

  allTournaments[index] = updatedTournament;

  try {
    localStorage.setItem(TOURNAMENTS_STORAGE_KEY, JSON.stringify(allTournaments));
  } catch (err) {
    console.error('Error saving finished match:', err);
  }

  apiSaveTournament(updatedTournament).catch((err) => {
    console.warn('[Sync] Failed saving finished match to server:', err);
  });

  window.dispatchEvent(
    new CustomEvent('lagilagipadel_tournaments_updated', {
      detail: { tournaments: allTournaments, affectedId: tournamentId, finishedMatch: true }
    })
  );

  return { updatedTournament, isGrandFinal };
};

/**
 * Retrieves all pool (group stage) matches for a tournament.
 * If round-robin matches are not yet scheduled for registered pool teams,
 * generates scheduled fixtures so both finished and scheduled matches appear.
 */
export const getOrGeneratePoolMatches = (tournamentId: string): TournamentMatch[] => {
  if (!tournamentId) return [];
  const tourney = getStoredTournamentById(tournamentId);
  if (!tourney) return [];

  // 1. Get pool groups from group storage or tourney
  let poolGroups: { poolName: string; teams: { id: string; name: string; p1: string; p2: string; seed?: number }[] }[] = [];
  try {
    const raw = localStorage.getItem(`lagilagipadel_groups_${tournamentId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) poolGroups = parsed;
      else if (parsed && Array.isArray(parsed.pools)) poolGroups = parsed.pools;
    }
  } catch (e) {
    console.error('Error reading groups for pool matches:', e);
  }

  // If poolGroups is empty, construct from tourney.groupStandings
  if (poolGroups.length === 0 || poolGroups.every((g) => g.teams.length === 0)) {
    const poolNames = tourney.groupStandings?.pools?.filter((p) => p !== 'Semua Pool') || ['Pool A', 'Pool B'];
    poolGroups = poolNames.map((pName) => ({
      poolName: pName,
      teams: (tourney.groupStandings?.standings || [])
        .filter((s) => s.pool === pName)
        .map((s, idx) => ({
          id: s.id || `st-${tournamentId}-${pName}-${idx + 1}`,
          name: s.name,
          p1: s.p1 || s.name.split('&')[0]?.trim() || '',
          p2: s.p2 || s.name.split('&')[1]?.trim() || '',
          seed: idx + 1
        }))
    }));
  }

  // Fallback: If participants exist but teams empty in poolGroups
  if (poolGroups.every((g) => g.teams.length === 0) && tourney.participants && tourney.participants.length > 0) {
    tourney.participants.forEach((p, idx) => {
      const pName = p.pool || (poolGroups[idx % poolGroups.length]?.poolName || 'Pool A');
      let grp = poolGroups.find((g) => g.poolName === pName);
      if (!grp) {
        grp = { poolName: pName, teams: [] };
        poolGroups.push(grp);
      }
      grp.teams.push({
        id: `part-${idx + 1}`,
        name: p.teamName,
        p1: p.p1,
        p2: p.p2,
        seed: p.seed
      });
    });
  }

  // 2. Existing matches in tourney.matches
  const existingMatches = tourney.matches || [];
  const existingPoolMatches = existingMatches.filter(
    (m) => m.roundCategory === 'grup' || m.round.toLowerCase().includes('pool') || m.round.toLowerCase().includes('grup')
  );

  const resultMatches: TournamentMatch[] = [...existingPoolMatches];

  // 3. For each pool, ensure all team pairings have a match fixture (finished or scheduled)
  poolGroups.forEach((group) => {
    const teams = group.teams;
    if (teams.length >= 2) {
      let fixtureIdx = 0;
      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          fixtureIdx++;
          const t1 = teams[i];
          const t2 = teams[j];

          // Check if match already exists between t1 and t2 in this pool
          const matchExists = resultMatches.some((m) => {
            const norm1 = t1.name.trim().toLowerCase();
            const norm2 = t2.name.trim().toLowerCase();
            const maNorm = m.teamA.trim().toLowerCase();
            const mbNorm = m.teamB.trim().toLowerCase();
            return (
              (maNorm === norm1 && mbNorm === norm2) ||
              (maNorm === norm2 && mbNorm === norm1)
            );
          });

          if (!matchExists) {
            const courtNum = (fixtureIdx % (tourney.totalCourts || 4)) + 1;
            const hour = 9 + Math.floor(fixtureIdx / 2);
            const minute = fixtureIdx % 2 === 0 ? '00' : '45';
            resultMatches.push({
              id: `fixture-${tournamentId}-${group.poolName.replace(/\s+/g, '').toLowerCase()}-${t1.id || i + 1}v${t2.id || j + 1}`,
              round: `Babak Grup - ${group.poolName} Match ${fixtureIdx}`,
              roundCategory: 'grup',
              court: `Court ${courtNum}`,
              time: `${String(hour).padStart(2, '0')}:${minute} WIB`,
              teamA: t1.name,
              playersA: t1.p1 && t1.p2 ? `${t1.p1} / ${t1.p2}` : t1.name,
              teamB: t2.name,
              playersB: t2.p1 && t2.p2 ? `${t2.p1} / ${t2.p2}` : t2.name,
              scoreA: '-',
              scoreB: '-',
              winner: 'scheduled',
              status: 'Dijadwalkan'
            });
          }
        }
      }
    }
  });

  return resultMatches;
};

/**
 * Saves or updates a pool match and automatically recalculates group standings.
 */
export const savePoolMatch = (
  tournamentId: string,
  updatedMatch: TournamentMatch
): void => {
  const allTournaments = getStoredTournaments();
  const index = allTournaments.findIndex((t) => t.id === tournamentId);
  if (index === -1) return;

  const tourney = allTournaments[index];
  const existingMatches = tourney.matches || [];
  const matchIndex = existingMatches.findIndex((m) => m.id === updatedMatch.id);

  let newMatches: TournamentMatch[];
  if (matchIndex >= 0) {
    newMatches = [...existingMatches];
    newMatches[matchIndex] = updatedMatch;
  } else {
    newMatches = [...existingMatches, updatedMatch];
  }

  // Recalculate group standings based on all finished group matches in newMatches
  let updatedGroupStandings = tourney.groupStandings;
  if (updatedGroupStandings?.standings) {
    const baseStandings = updatedGroupStandings.standings.map((st) => ({
      ...st,
      played: 0,
      won: 0,
      lost: 0,
      gamesWon: 0,
      gamesLost: 0,
      gameDiff: 0,
      points: 0
    }));

    // Replay all finished matches
    newMatches.forEach((m) => {
      if (m.roundCategory === 'grup' && m.status === 'Selesai') {
        const scoreA = parseInt(m.scoreA, 10) || 0;
        const scoreB = parseInt(m.scoreB, 10) || 0;
        const normA = m.teamA.trim().toLowerCase();
        const normB = m.teamB.trim().toLowerCase();

        const rowA = baseStandings.find((s) => s.name.trim().toLowerCase() === normA);
        const rowB = baseStandings.find((s) => s.name.trim().toLowerCase() === normB);

        if (rowA) {
          rowA.played += 1;
          rowA.gamesWon += scoreA;
          rowA.gamesLost += scoreB;
          rowA.gameDiff = rowA.gamesWon - rowA.gamesLost;
          if (m.winner === 'A') {
            rowA.won += 1;
            rowA.points += 2;
          } else if (m.winner === 'B') {
            rowA.lost += 1;
          }
        }

        if (rowB) {
          rowB.played += 1;
          rowB.gamesWon += scoreB;
          rowB.gamesLost += scoreA;
          rowB.gameDiff = rowB.gamesWon - rowB.gamesLost;
          if (m.winner === 'B') {
            rowB.won += 1;
            rowB.points += 2;
          } else if (m.winner === 'A') {
            rowB.lost += 1;
          }
        }
      }
    });

    // Re-rank each pool
    const poolNames = updatedGroupStandings.pools.filter((p) => p !== 'Semua Pool');
    const rankedStandings: PoolTeamStanding[] = [];
    poolNames.forEach((pName) => {
      const poolTeams = baseStandings
        .filter((r) => r.pool === pName)
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
          return (b.gamesWon || 0) - (a.gamesWon || 0);
        })
        .map((r, idx) => ({
          ...r,
          pos: idx + 1,
          isQualified: (r.played || 0) > 0 && idx < 2
        }));
      rankedStandings.push(...poolTeams);
    });

    updatedGroupStandings = {
      ...updatedGroupStandings,
      standings: rankedStandings.length > 0 ? rankedStandings : baseStandings
    };
  }

  const updatedTournament: FullTournamentDetail = {
    ...tourney,
    matches: newMatches,
    groupStandings: updatedGroupStandings
  };

  allTournaments[index] = updatedTournament;
  try {
    localStorage.setItem(TOURNAMENTS_STORAGE_KEY, JSON.stringify(allTournaments));
  } catch (e) {
    console.error(e);
  }

  apiSaveTournament(updatedTournament).catch((err) => {
    console.warn('[Sync] Server save pool match error:', err);
  });

  window.dispatchEvent(
    new CustomEvent('lagilagipadel_tournaments_updated', {
      detail: { tournaments: allTournaments, affectedId: tournamentId }
    })
  );
};
