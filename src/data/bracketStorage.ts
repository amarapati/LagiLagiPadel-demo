import { KnockoutMatch } from './padelProTournamentsData';
import { getStoredTournamentById } from './tournamentStorage';
import { apiSaveBracket } from './apiClient';

export interface KnockoutBracketData {
  roundOf16?: KnockoutMatch[];
  quarters: KnockoutMatch[];
  semis: KnockoutMatch[];
  grandFinal: KnockoutMatch;
  bronzeMatch?: KnockoutMatch;
}

const STORAGE_PREFIX = 'lagilagipadel_bracket_';

export type KnockoutStartingStage = 'roundOf16' | 'quarters' | 'semis' | 'final';

export function getAvailableKnockoutStagesForPools(poolCount: number): {
  id: KnockoutStartingStage;
  label: string;
  badge: string;
  desc: string;
}[] {
  if (poolCount <= 2) {
    return [
      {
        id: 'semis',
        label: 'Babak Semifinal & Grand Final (+ Juara 3)',
        badge: 'Top 2 Lolos · 4 Tim',
        desc: 'Standar 2 Pool: Juara & Runner-up Pool A & B lolos langsung ke Semifinal'
      },
      {
        id: 'final',
        label: 'Langsung Grand Final Saja',
        badge: 'Top 1 Lolos · 2 Tim',
        desc: 'Hanya Juara Pool A vs Juara Pool B yang bertanding di Final'
      }
    ];
  } else if (poolCount <= 4) {
    return [
      {
        id: 'quarters',
        label: 'Babak Perempat Final (QF), Semifinal & Final (+ Juara 3)',
        badge: 'Top 2 Lolos · 8 Tim',
        desc: 'Standar 3-4 Pool: Juara & Runner-up setiap pool bertanding di Perempat Final'
      },
      {
        id: 'semis',
        label: 'Langsung Babak Semifinal & Final',
        badge: 'Top 1 Lolos · 4 Tim',
        desc: 'Hanya Juara masing-masing Pool yang lolos langsung ke Semifinal'
      },
      {
        id: 'final',
        label: 'Langsung Grand Final Saja',
        badge: '2 Tim Terbaik',
        desc: 'Hanya 2 Tim Terbaik turnamen yang langsung menuju Grand Final'
      }
    ];
  } else if (poolCount <= 8) {
    return [
      {
        id: 'roundOf16',
        label: 'Babak 16 Besar (R16), Perempat Final, Semifinal & Final',
        badge: 'Top 2 Lolos · 16 Tim',
        desc: 'Standar 5-8 Pool: 16 tim bertanding mulai dari Round of 16 (8 laga)'
      },
      {
        id: 'quarters',
        label: 'Babak Perempat Final (QF), Semifinal & Final',
        badge: 'Top 1 Lolos · 8 Tim',
        desc: 'Hanya Juara Pool A s.d. Pool H yang lolos ke Babak Perempat Final'
      },
      {
        id: 'semis',
        label: 'Langsung Babak Semifinal & Final',
        badge: '4 Tim Terbaik',
        desc: '4 Juara Pool teratas langsung bertanding di Semifinal'
      }
    ];
  } else {
    return [
      {
        id: 'roundOf16',
        label: 'Babak 16 Besar (R16), Perempat Final, Semifinal & Final',
        badge: '16 Tim Lolos Playoff',
        desc: '16 Tim Terbaik babak penyisihan lolos ke Round of 16'
      },
      {
        id: 'quarters',
        label: 'Babak Perempat Final (QF), Semifinal & Final',
        badge: '8 Tim Juara Pool',
        desc: '8 Tim Juara Pool teratas melaju ke Babak Perempat Final'
      },
      {
        id: 'semis',
        label: 'Langsung Babak Semifinal & Final',
        badge: '4 Tim Terbaik',
        desc: '4 Tim Teratas langsung bertanding di Semifinal'
      }
    ];
  }
}

export function getDefaultStageForPools(poolCount: number): KnockoutStartingStage {
  if (poolCount <= 2) return 'semis';
  if (poolCount <= 4) return 'quarters';
  return 'roundOf16';
}

// Dynamic clean template matching active pool count and knockout stage
export const generateBracketForPoolCount = (
  poolCount: number = 4,
  startingStage?: KnockoutStartingStage
): KnockoutBracketData => {
  const stage = startingStage || getDefaultStageForPools(poolCount);

  const grandFinal: KnockoutMatch = {
    id: 'gf-1',
    roundTitle: 'Grand Final (Gold Match)',
    court: 'Court 1',
    time: '16:30 WIB',
    team1: { name: 'Pemenang SF 1', players: 'TBD', score: '-', isWinner: false },
    team2: { name: 'Pemenang SF 2', players: 'TBD', score: '-', isWinner: false },
    status: 'Dijadwalkan'
  };

  const bronzeMatch: KnockoutMatch = {
    id: 'bm-1',
    roundTitle: 'Perebutan Juara 3 (Bronze Match)',
    court: 'Court 2',
    time: '15:15 WIB',
    team1: { name: 'Semifinalis 1', players: 'TBD', score: '-', isWinner: false },
    team2: { name: 'Semifinalis 2', players: 'TBD', score: '-', isWinner: false },
    status: 'Dijadwalkan'
  };

  if (stage === 'final') {
    return {
      roundOf16: [],
      quarters: [],
      semis: [],
      grandFinal: {
        ...grandFinal,
        team1: { name: 'Juara Pool A', players: 'TBD', score: '-', isWinner: false },
        team2: { name: 'Juara Pool B', players: 'TBD', score: '-', isWinner: false }
      }
    };
  }

  const semis: KnockoutMatch[] = [
    {
      id: 'sf-1',
      roundTitle: stage === 'semis' && poolCount <= 2
        ? 'Semifinal 1 (Juara Pool A vs Runner-up Pool B)'
        : 'Semifinal 1 (Pemenang QF 1 vs QF 3)',
      court: 'Court 1',
      time: '14:00 WIB',
      team1: {
        name: stage === 'semis' && poolCount <= 2 ? 'Juara Pool A' : 'Pemenang QF 1',
        players: 'TBD',
        score: '-',
        isWinner: false
      },
      team2: {
        name: stage === 'semis' && poolCount <= 2 ? 'Runner-up Pool B' : 'Pemenang QF 3',
        players: 'TBD',
        score: '-',
        isWinner: false
      },
      status: 'Dijadwalkan'
    },
    {
      id: 'sf-2',
      roundTitle: stage === 'semis' && poolCount <= 2
        ? 'Semifinal 2 (Juara Pool B vs Runner-up Pool A)'
        : 'Semifinal 2 (Pemenang QF 2 vs QF 4)',
      court: 'Court 2',
      time: '14:00 WIB',
      team1: {
        name: stage === 'semis' && poolCount <= 2 ? 'Juara Pool B' : 'Pemenang QF 2',
        players: 'TBD',
        score: '-',
        isWinner: false
      },
      team2: {
        name: stage === 'semis' && poolCount <= 2 ? 'Runner-up Pool A' : 'Pemenang QF 4',
        players: 'TBD',
        score: '-',
        isWinner: false
      },
      status: 'Dijadwalkan'
    }
  ];

  if (stage === 'semis') {
    return {
      roundOf16: [],
      quarters: [],
      semis,
      grandFinal,
      bronzeMatch
    };
  }

  const quarters: KnockoutMatch[] = [
    {
      id: 'qf-1',
      roundTitle: 'Perempat Final 1 (Juara Pool A vs Runner-up Pool B)',
      court: 'Court 1',
      time: '12:30 WIB',
      team1: { name: 'Juara Pool A', players: 'TBD', score: '-', isWinner: false },
      team2: { name: 'Runner-up Pool B', players: 'TBD', score: '-', isWinner: false },
      status: 'Dijadwalkan'
    },
    {
      id: 'qf-2',
      roundTitle: 'Perempat Final 2 (Juara Pool B vs Runner-up Pool A)',
      court: 'Court 2',
      time: '12:30 WIB',
      team1: { name: 'Juara Pool B', players: 'TBD', score: '-', isWinner: false },
      team2: { name: 'Runner-up Pool A', players: 'TBD', score: '-', isWinner: false },
      status: 'Dijadwalkan'
    },
    {
      id: 'qf-3',
      roundTitle: 'Perempat Final 3 (Juara Pool C vs Runner-up Pool D)',
      court: 'Court 3',
      time: '13:15 WIB',
      team1: { name: 'Juara Pool C', players: 'TBD', score: '-', isWinner: false },
      team2: { name: 'Runner-up Pool D', players: 'TBD', score: '-', isWinner: false },
      status: 'Dijadwalkan'
    },
    {
      id: 'qf-4',
      roundTitle: 'Perempat Final 4 (Juara Pool D vs Runner-up Pool C)',
      court: 'Court 4',
      time: '13:15 WIB',
      team1: { name: 'Juara Pool D', players: 'TBD', score: '-', isWinner: false },
      team2: { name: 'Runner-up Pool C', players: 'TBD', score: '-', isWinner: false },
      status: 'Dijadwalkan'
    }
  ];

  if (stage === 'quarters') {
    return {
      roundOf16: [],
      quarters,
      semis,
      grandFinal,
      bronzeMatch
    };
  }

  // stage === 'roundOf16'
  const roundOf16: KnockoutMatch[] = Array.from({ length: 8 }, (_, i) => ({
    id: `r16-${i + 1}`,
    roundTitle: `Babak 16 Besar #${i + 1}`,
    court: `Court ${(i % 4) + 1}`,
    time: '10:00 WIB',
    team1: {
      name: `Juara Pool ${String.fromCharCode(65 + i)}`,
      players: 'TBD',
      score: '-',
      isWinner: false
    },
    team2: {
      name: `Runner-up Pool ${String.fromCharCode(65 + ((i + 1) % 8))}`,
      players: 'TBD',
      score: '-',
      isWinner: false
    },
    status: 'Dijadwalkan'
  }));

  return {
    roundOf16,
    quarters,
    semis,
    grandFinal,
    bronzeMatch
  };
};

// Clean blank template for reset total (empty system)
export const getCleanEmptyBracket = (): KnockoutBracketData => {
  return generateBracketForPoolCount(4);
};

// Default template: returns tournament's bracket if stored, otherwise clean empty bracket
export const getDefaultBracket = (tournamentId: string): KnockoutBracketData => {
  if (!tournamentId) return getCleanEmptyBracket();
  const tourney = getStoredTournamentById(tournamentId);
  if (tourney && tourney.knockoutBracket) {
    return JSON.parse(JSON.stringify(tourney.knockoutBracket));
  }

  // Fallback to clean empty bracket (no fake scores/teams)
  return getCleanEmptyBracket();
};

export const getStoredBracket = (tournamentId: string): KnockoutBracketData => {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${tournamentId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.grandFinal) {
        return {
          roundOf16: parsed.roundOf16 || [],
          quarters: parsed.quarters || [],
          semis: parsed.semis || [],
          grandFinal: parsed.grandFinal,
          bronzeMatch: parsed.bronzeMatch
        };
      }
    }
  } catch (err) {
    console.error('Error reading stored bracket:', err);
  }
  return getDefaultBracket(tournamentId);
};

export const saveStoredBracket = (tournamentId: string, bracket: KnockoutBracketData): void => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${tournamentId}`, JSON.stringify(bracket));
    apiSaveBracket(tournamentId, bracket).catch((err) => {
      console.warn('[Sync] Server bracket error:', err);
    });
    // Dispatch custom event for real-time reactive sync across active components
    window.dispatchEvent(
      new CustomEvent('lagilagipadel_bracket_updated', {
        detail: { tournamentId, bracket }
      })
    );
  } catch (err) {
    console.error('Error saving stored bracket:', err);
  }
};

export const resetStoredBracket = (tournamentId: string): KnockoutBracketData => {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${tournamentId}`);
    const defaultData = getDefaultBracket(tournamentId);
    window.dispatchEvent(
      new CustomEvent('lagilagipadel_bracket_updated', {
        detail: { tournamentId, bracket: defaultData }
      })
    );
    return defaultData;
  } catch (err) {
    console.error('Error resetting stored bracket:', err);
    return getDefaultBracket(tournamentId);
  }
};

/**
 * Normalizes string for flexible matching
 */
const normStr = (s?: string): string => {
  if (!s) return '';
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
};

/**
 * Updates a match's live score and status to 'Live' within the knockout bracket.
 */
export const syncLiveScoreToBracket = (
  tournamentId: string,
  matchPhase: string,
  teamAName: string,
  teamBName: string,
  scoreA: string | number,
  scoreB: string | number,
  courtName: string = 'Court 1'
): boolean => {
  try {
    const bracket = getStoredBracket(tournamentId);
    if (!bracket) return false;

    const normPhase = normStr(matchPhase);
    const normA = normStr(teamAName);
    const normB = normStr(teamBName);

    let matchFound = false;

    // Helper to test if a match node matches
    const isMatchTarget = (node: KnockoutMatch, phasePattern: string) => {
      if (normPhase.includes(phasePattern)) return true;
      const t1 = normStr(node.team1.name);
      const t2 = normStr(node.team2.name);
      if (normA && (t1.includes(normA) || normA.includes(t1))) return true;
      if (normB && (t2.includes(normB) || normB.includes(t2))) return true;
      return false;
    };

    // 1. Check Grand Final
    if (bracket.grandFinal && (normPhase.includes('final') && !normPhase.includes('perempat') && !normPhase.includes('quarter') && !normPhase.includes('semi') && !normPhase.includes('3') && !normPhase.includes('bronze') || isMatchTarget(bracket.grandFinal, 'grandfinal'))) {
      bracket.grandFinal.status = 'Live';
      bracket.grandFinal.court = courtName;
      if (teamAName && teamAName !== 'Tim A (TBD)') bracket.grandFinal.team1.name = teamAName;
      if (teamBName && teamBName !== 'Tim B (TBD)') bracket.grandFinal.team2.name = teamBName;
      bracket.grandFinal.team1.score = String(scoreA);
      bracket.grandFinal.team2.score = String(scoreB);
      matchFound = true;
    }
    // 2. Check Bronze Match
    else if (bracket.bronzeMatch && (normPhase.includes('3') || normPhase.includes('bronze') || isMatchTarget(bracket.bronzeMatch, 'bronze'))) {
      bracket.bronzeMatch.status = 'Live';
      bracket.bronzeMatch.court = courtName;
      if (teamAName && teamAName !== 'Tim A (TBD)') bracket.bronzeMatch.team1.name = teamAName;
      if (teamBName && teamBName !== 'Tim B (TBD)') bracket.bronzeMatch.team2.name = teamBName;
      bracket.bronzeMatch.team1.score = String(scoreA);
      bracket.bronzeMatch.team2.score = String(scoreB);
      matchFound = true;
    }
    // 3. Check Semis
    else if (bracket.semis && bracket.semis.length >= 2) {
      if (normPhase.includes('semi') && normPhase.includes('1') || isMatchTarget(bracket.semis[0], 'semi1')) {
        bracket.semis[0].status = 'Live';
        bracket.semis[0].court = courtName;
        if (teamAName && teamAName !== 'Tim A (TBD)') bracket.semis[0].team1.name = teamAName;
        if (teamBName && teamBName !== 'Tim B (TBD)') bracket.semis[0].team2.name = teamBName;
        bracket.semis[0].team1.score = String(scoreA);
        bracket.semis[0].team2.score = String(scoreB);
        matchFound = true;
      } else if (normPhase.includes('semi') && normPhase.includes('2') || isMatchTarget(bracket.semis[1], 'semi2')) {
        bracket.semis[1].status = 'Live';
        bracket.semis[1].court = courtName;
        if (teamAName && teamAName !== 'Tim A (TBD)') bracket.semis[1].team1.name = teamAName;
        if (teamBName && teamBName !== 'Tim B (TBD)') bracket.semis[1].team2.name = teamBName;
        bracket.semis[1].team1.score = String(scoreA);
        bracket.semis[1].team2.score = String(scoreB);
        matchFound = true;
      }
    }
    // 4. Check Quarters
    if (!matchFound && bracket.quarters && bracket.quarters.length >= 4) {
      for (let i = 0; i < 4; i++) {
        const qf = bracket.quarters[i];
        if (normPhase.includes(`qf${i + 1}`) || normPhase.includes(`quarter${i + 1}`) || normPhase.includes(`perempat${i + 1}`) || isMatchTarget(qf, `qf${i + 1}`)) {
          qf.status = 'Live';
          qf.court = courtName;
          if (teamAName && teamAName !== 'Tim A (TBD)') qf.team1.name = teamAName;
          if (teamBName && teamBName !== 'Tim B (TBD)') qf.team2.name = teamBName;
          qf.team1.score = String(scoreA);
          qf.team2.score = String(scoreB);
          matchFound = true;
          break;
        }
      }
    }

    // 5. Check Round of 16
    if (!matchFound && bracket.roundOf16 && bracket.roundOf16.length >= 8) {
      for (let i = 0; i < bracket.roundOf16.length; i++) {
        const r16 = bracket.roundOf16[i];
        if (normPhase.includes(`r16#${i + 1}`) || normPhase.includes(`16#${i + 1}`) || (normPhase.includes('16') && normPhase.includes(`${i + 1}`)) || isMatchTarget(r16, `r16-${i + 1}`)) {
          r16.status = 'Live';
          r16.court = courtName;
          if (teamAName && teamAName !== 'Tim A (TBD)') r16.team1.name = teamAName;
          if (teamBName && teamBName !== 'Tim B (TBD)') r16.team2.name = teamBName;
          r16.team1.score = String(scoreA);
          r16.team2.score = String(scoreB);
          matchFound = true;
          break;
        }
      }
    }

    if (matchFound) {
      saveStoredBracket(tournamentId, bracket);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Error syncing live score to bracket:', err);
    return false;
  }
};

/**
 * Completes a knockout match, marks winner/scores, and automatically advances the winner to the next round.
 */
export const findAndAdvanceMatchInBracket = (
  tournamentId: string,
  matchPhase: string,
  teamAName: string,
  teamBName: string,
  scoreA: string | number,
  scoreB: string | number,
  winnerChoice: 'A' | 'B'
): {
  success: boolean;
  roundMatched: string;
  winnerName: string;
  loserName: string;
  advancedTo: string;
} => {
  const bracket = getStoredBracket(tournamentId);
  const normPhase = normStr(matchPhase);
  const normA = normStr(teamAName);
  const normB = normStr(teamBName);

  const winnerName = winnerChoice === 'A' ? teamAName : teamBName;
  const loserName = winnerChoice === 'A' ? teamBName : teamAName;
  const winnerScore = String(winnerChoice === 'A' ? scoreA : scoreB);
  const loserScore = String(winnerChoice === 'A' ? scoreB : scoreA);

  let roundMatched = '';
  let advancedTo = '';

  // Helper matcher
  const matchesTeams = (m: KnockoutMatch) => {
    const t1 = normStr(m.team1.name);
    const t2 = normStr(m.team2.name);
    if (!normA && !normB) return false;
    const aIn = (normA && (t1.includes(normA) || normA.includes(t1) || t2.includes(normA) || normA.includes(t2)));
    const bIn = (normB && (t1.includes(normB) || normB.includes(t1) || t2.includes(normB) || normB.includes(t2)));
    return aIn || bIn;
  };

  // 1. Check Round of 16 (if exists)
  if (bracket.roundOf16 && bracket.roundOf16.length >= 8 && (normPhase.includes('16') || normPhase.includes('r16'))) {
    let r16Index = -1;
    for (let i = 0; i < 8; i++) {
      if (normPhase.includes(`${i + 1}`)) {
        r16Index = i;
        break;
      }
    }
    if (r16Index === -1) {
      r16Index = bracket.roundOf16.findIndex((r) => matchesTeams(r));
    }

    if (r16Index >= 0 && r16Index < bracket.roundOf16.length) {
      const matchNode = bracket.roundOf16[r16Index];
      roundMatched = `Round of 16 #${r16Index + 1}`;
      matchNode.status = 'Selesai';
      matchNode.team1.name = teamAName;
      matchNode.team2.name = teamBName;
      matchNode.team1.score = String(scoreA);
      matchNode.team2.score = String(scoreB);
      matchNode.team1.isWinner = winnerChoice === 'A';
      matchNode.team2.isWinner = winnerChoice === 'B';

      // Auto advance to corresponding Quarterfinal
      if (bracket.quarters && bracket.quarters.length >= 4) {
        const targetQfIdx = Math.floor(r16Index / 2);
        const slot = r16Index % 2 === 0 ? 'team1' : 'team2';
        bracket.quarters[targetQfIdx][slot].name = winnerName;
        bracket.quarters[targetQfIdx][slot].players = winnerName;
        advancedTo = `Perempat Final ${targetQfIdx + 1} (${slot === 'team1' ? 'Slot Tim 1' : 'Slot Tim 2'})`;
      }

      saveStoredBracket(tournamentId, bracket);
      return { success: true, roundMatched, winnerName, loserName, advancedTo };
    }
  }

  // 2. Quarters
  if (bracket.quarters && bracket.quarters.length >= 4) {
    let qfIndex = -1;
    if (normPhase.includes('1') && (normPhase.includes('qf') || normPhase.includes('quarter') || normPhase.includes('perempat'))) qfIndex = 0;
    else if (normPhase.includes('2') && (normPhase.includes('qf') || normPhase.includes('quarter') || normPhase.includes('perempat'))) qfIndex = 1;
    else if (normPhase.includes('3') && (normPhase.includes('qf') || normPhase.includes('quarter') || normPhase.includes('perempat'))) qfIndex = 2;
    else if (normPhase.includes('4') && (normPhase.includes('qf') || normPhase.includes('quarter') || normPhase.includes('perempat'))) qfIndex = 3;
    else {
      // Find by team names
      qfIndex = bracket.quarters.findIndex((q) => matchesTeams(q));
    }

    if (qfIndex >= 0 && qfIndex < bracket.quarters.length) {
      const qf = bracket.quarters[qfIndex];
      roundMatched = `Perempat Final ${qfIndex + 1}`;
      qf.status = 'Selesai';
      qf.team1.name = teamAName;
      qf.team2.name = teamBName;
      qf.team1.score = String(scoreA);
      qf.team2.score = String(scoreB);
      qf.team1.isWinner = winnerChoice === 'A';
      qf.team2.isWinner = winnerChoice === 'B';

      // Auto-advance to Semifinal
      if (bracket.semis && bracket.semis.length >= 2) {
        if (qfIndex === 0) {
          bracket.semis[0].team1.name = winnerName;
          bracket.semis[0].team1.players = winnerName;
          advancedTo = 'Semifinal 1 (Slot Tim 1)';
        } else if (qfIndex === 1) {
          bracket.semis[0].team2.name = winnerName;
          bracket.semis[0].team2.players = winnerName;
          advancedTo = 'Semifinal 1 (Slot Tim 2)';
        } else if (qfIndex === 2) {
          bracket.semis[1].team1.name = winnerName;
          bracket.semis[1].team1.players = winnerName;
          advancedTo = 'Semifinal 2 (Slot Tim 1)';
        } else if (qfIndex === 3) {
          bracket.semis[1].team2.name = winnerName;
          bracket.semis[1].team2.players = winnerName;
          advancedTo = 'Semifinal 2 (Slot Tim 2)';
        }
      }

      saveStoredBracket(tournamentId, bracket);
      return { success: true, roundMatched, winnerName, loserName, advancedTo };
    }
  }

  // 2. Semifinals
  if (bracket.semis && bracket.semis.length >= 2) {
    let sfIndex = -1;
    if (normPhase.includes('semi') && normPhase.includes('1')) sfIndex = 0;
    else if (normPhase.includes('semi') && normPhase.includes('2')) sfIndex = 1;
    else {
      sfIndex = bracket.semis.findIndex((s) => matchesTeams(s));
    }

    if (sfIndex >= 0 && sfIndex < bracket.semis.length) {
      const sf = bracket.semis[sfIndex];
      roundMatched = `Semifinal ${sfIndex + 1}`;
      sf.status = 'Selesai';
      sf.team1.name = teamAName;
      sf.team2.name = teamBName;
      sf.team1.score = String(scoreA);
      sf.team2.score = String(scoreB);
      sf.team1.isWinner = winnerChoice === 'A';
      sf.team2.isWinner = winnerChoice === 'B';

      // Auto-advance to Grand Final & Bronze Match
      if (bracket.grandFinal) {
        if (sfIndex === 0) {
          bracket.grandFinal.team1.name = winnerName;
          bracket.grandFinal.team1.players = winnerName;
          if (bracket.bronzeMatch) {
            bracket.bronzeMatch.team1.name = loserName;
            bracket.bronzeMatch.team1.players = loserName;
          }
          advancedTo = 'Grand Final (Gold Match) & Perebutan Juara 3 (Bronze)';
        } else {
          bracket.grandFinal.team2.name = winnerName;
          bracket.grandFinal.team2.players = winnerName;
          if (bracket.bronzeMatch) {
            bracket.bronzeMatch.team2.name = loserName;
            bracket.bronzeMatch.team2.players = loserName;
          }
          advancedTo = 'Grand Final (Gold Match) & Perebutan Juara 3 (Bronze)';
        }
      }

      saveStoredBracket(tournamentId, bracket);
      return { success: true, roundMatched, winnerName, loserName, advancedTo };
    }
  }

  // 3. Grand Final
  if (bracket.grandFinal && (normPhase.includes('final') && !normPhase.includes('semi') && !normPhase.includes('perempat') && !normPhase.includes('quarter') && !normPhase.includes('3') || matchesTeams(bracket.grandFinal))) {
    const gf = bracket.grandFinal;
    roundMatched = 'Grand Final';
    gf.status = 'Selesai';
    gf.team1.name = teamAName;
    gf.team2.name = teamBName;
    gf.team1.score = String(scoreA);
    gf.team2.score = String(scoreB);
    gf.team1.isWinner = winnerChoice === 'A';
    gf.team2.isWinner = winnerChoice === 'B';
    advancedTo = `Juara 1 Turnamen (Gold Champion): ${winnerName}`;

    saveStoredBracket(tournamentId, bracket);
    return { success: true, roundMatched, winnerName, loserName, advancedTo };
  }

  // 4. Bronze Match
  if (bracket.bronzeMatch && (normPhase.includes('3') || normPhase.includes('bronze') || matchesTeams(bracket.bronzeMatch))) {
    const bm = bracket.bronzeMatch;
    roundMatched = 'Perebutan Juara 3';
    bm.status = 'Selesai';
    bm.team1.name = teamAName;
    bm.team2.name = teamBName;
    bm.team1.score = String(scoreA);
    bm.team2.score = String(scoreB);
    bm.team1.isWinner = winnerChoice === 'A';
    bm.team2.isWinner = winnerChoice === 'B';
    advancedTo = `Juara 3 Turnamen (Bronze Medalist): ${winnerName}`;

    saveStoredBracket(tournamentId, bracket);
    return { success: true, roundMatched, winnerName, loserName, advancedTo };
  }

  // Fallback: save anyway
  saveStoredBracket(tournamentId, bracket);
  return {
    success: false,
    roundMatched: matchPhase,
    winnerName,
    loserName,
    advancedTo: 'Tidak terpetakan ke slot bracket otomatis'
  };
};
