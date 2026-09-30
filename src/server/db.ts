import { createClient, Client } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { PADEL_TOURNAMENTS_DATA, FullTournamentDetail } from '../data/padelProTournamentsData';
import { DEFAULT_CLUB_MEMBERS, ClubMember } from '../data/clubMembersStorage';
import { DEFAULT_REFEREE_STATE, RefereeScoringState } from '../data/refereeStorage';
import { getDefaultTournamentGroups, PoolGroupData } from '../data/tournamentGroupStorage';
import { getStoredBracket, KnockoutBracketData } from '../data/bracketStorage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE_PATH = path.resolve(__dirname, '../../padel_database.sqlite');

let dbClient: Client | null = null;

export function getDb(): Client {
  if (!dbClient) {
    dbClient = createClient({
      url: `file:${DB_FILE_PATH}`
    });
  }
  return dbClient;
}

/**
 * Initializes SQLite schema and seeds default data if tables are empty.
 */
export async function initDatabase(): Promise<void> {
  const db = getDb();

  // Create tables
  await db.execute(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      category TEXT,
      date TEXT,
      location TEXT,
      total_prize TEXT,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      nickname TEXT,
      photo_url TEXT,
      phone TEXT,
      email TEXT,
      club TEXT,
      city TEXT,
      rating TEXT,
      gender TEXT,
      membership_tier TEXT,
      joined_date TEXT,
      status TEXT,
      is_group_qualified INTEGER DEFAULT 0,
      qualified_tournament TEXT,
      qualified_pool TEXT,
      qualified_phase TEXT,
      achievements TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tournament_groups (
      tournament_id TEXT PRIMARY KEY,
      pools_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS brackets (
      tournament_id TEXT PRIMARY KEY,
      bracket_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS referee_state (
      id TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS system_meta (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  // Check if we need to seed
  const tourneyCount = await db.execute('SELECT COUNT(*) as cnt FROM tournaments');
  const count = Number(tourneyCount.rows[0]?.cnt || 0);

  if (count === 0) {
    console.log('[SQLite] Empty database detected. Seeding initial tournaments, members, brackets, and groups...');
    await seedDefaultData();
  } else {
    console.log(`[SQLite] Database initialized. Loaded with ${count} tournaments.`);
    await syncAllDataWithMembers();
  }
}

const LEGACY_MEMBER_MAP: Record<string, string> = {
  'kartika aditoputro': 'LLP-MBR-001',
  'kartika': 'LLP-MBR-001',
  'tika': 'LLP-MBR-001',
  'dodie adam pratama': 'LLP-MBR-002',
  'dodie adam': 'LLP-MBR-002',
  'dodie': 'LLP-MBR-002',
  'olivia s.': 'LLP-MBR-003',
  'olivia': 'LLP-MBR-003',
  'oliv': 'LLP-MBR-003',
  'rico prasetya': 'LLP-MBR-004',
  'rico': 'LLP-MBR-004',
  'evan wirawan': 'LLP-MBR-005',
  'evan': 'LLP-MBR-005',
  'ngoe wijaya': 'LLP-MBR-006',
  'ngoe': 'LLP-MBR-006',
  'merry': 'LLP-MBR-007',
  'fifi': 'LLP-MBR-008',
  'nia': 'LLP-MBR-009',
  'sassa rizki': 'LLP-MBR-010',
  'sassa': 'LLP-MBR-010',
  'christina': 'LLP-MBR-011',
  'tina': 'LLP-MBR-011',
  'mega': 'LLP-MBR-012',
  'bagas pratama': 'LLP-MBR-013',
  'bagas': 'LLP-MBR-013',
  'dimas wicaksono': 'LLP-MBR-014',
  'dimas': 'LLP-MBR-014',
  'bimo prasetyo': 'LLP-MBR-015',
  'bimo': 'LLP-MBR-015',
  'farhan hakim': 'LLP-MBR-016',
  'farhan': 'LLP-MBR-016'
};

const LEGACY_TOURNAMENT_NAMES = new Set([
  'F3 Rookie Men vol 2',
  'Rookie Fix Mix Motion x Winny Grosir',
  'Rookie Fix Mix Motion',
  'Rookie Fix Mix',
  'HDMC PADEL CHAMPIONS',
  'HDMC Champions',
  'Beginner Men Showdown',
  'Beginner Showdown'
]);

const DEFAULT_PARTNER_PAIRS: Record<string, string> = {
  'LLP-MBR-001': 'LLP-MBR-002',
  'LLP-MBR-002': 'LLP-MBR-001',
  'LLP-MBR-003': 'LLP-MBR-004',
  'LLP-MBR-004': 'LLP-MBR-003',
  'LLP-MBR-005': 'LLP-MBR-006',
  'LLP-MBR-006': 'LLP-MBR-005',
  'LLP-MBR-007': 'LLP-MBR-008',
  'LLP-MBR-008': 'LLP-MBR-007',
  'LLP-MBR-009': 'LLP-MBR-010',
  'LLP-MBR-010': 'LLP-MBR-009',
  'LLP-MBR-011': 'LLP-MBR-012',
  'LLP-MBR-012': 'LLP-MBR-011',
  'LLP-MBR-013': 'LLP-MBR-014',
  'LLP-MBR-014': 'LLP-MBR-013',
  'LLP-MBR-015': 'LLP-MBR-016',
  'LLP-MBR-016': 'LLP-MBR-015'
};

/**
 * Synchronizes all members, tournament groups, standings, brackets, matches, and referee state
 * so that any admin edits to members or groups are reflected everywhere and no stale default names remain.
 */
export async function syncAllDataWithMembers(): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const members = await getAllMembers();
  const tournaments = await getAllTournaments();
  if (members.length === 0) return;

  const memberById = new Map<string, ClubMember>();
  members.forEach((m) => memberById.set(m.id, m));

  // Helper to resolve a member from an ID hint, player name hint, or team name part
  const resolveMember = (idHint?: string, nameHint?: string, teamPartHint?: string): ClubMember | undefined => {
    if (idHint && memberById.has(idHint)) {
      return memberById.get(idHint);
    }
    const candidates = [nameHint, teamPartHint].filter(Boolean) as string[];
    for (const raw of candidates) {
      const clean = raw.trim().toLowerCase();
      if (!clean) continue;
      const mappedId = LEGACY_MEMBER_MAP[clean];
      if (mappedId && memberById.has(mappedId)) {
        return memberById.get(mappedId);
      }
      const exact = members.find(
        (m) =>
          m.id.toLowerCase() === clean ||
          m.name.trim().toLowerCase() === clean ||
          (m.nickname && m.nickname.trim().toLowerCase() === clean)
      );
      if (exact) return exact;
    }
    return undefined;
  };

  const activeTourneyName = tournaments[0]?.name || 'Turnamen Resmi LagiLagiPadel';
  const anyTourneyHasMatches = tournaments.some(
    (t) =>
      (t.matches && t.matches.length > 0) ||
      (t.groupStandings?.standings && t.groupStandings.standings.some((s) => (s.played || 0) > 0))
  );

  // 1. Clean up member records (nicknames, partnerDefault, qualifiedTournament, isGroupQualified)
  for (const m of members) {
    let changed = false;
    const cleanNameLower = m.name.trim().toLowerCase();
    const cleanNickLower = (m.nickname || '').trim().toLowerCase();

    // If no tournament has any match played yet, reset premature isGroupQualified flags
    if (!anyTourneyHasMatches && m.isGroupQualified) {
      m.isGroupQualified = false;
      m.qualifiedPhase = 'Terdaftar di Fase Grup';
      changed = true;
    }

    // If nickname is a legacy default name that doesn't match the admin's new member name
    if (cleanNickLower && LEGACY_MEMBER_MAP[cleanNickLower] === m.id && !cleanNameLower.includes(cleanNickLower)) {
      m.nickname = m.name;
      changed = true;
    }

    // If partnerDefault is a legacy name, update it to the paired member's current name
    const partnerRaw = (m.achievements?.partnerDefault || '').trim();
    const partnerMappedId = LEGACY_MEMBER_MAP[partnerRaw.toLowerCase()] || DEFAULT_PARTNER_PAIRS[m.id];
    if (partnerRaw && LEGACY_MEMBER_MAP[partnerRaw.toLowerCase()]) {
      const partnerMember = partnerMappedId ? memberById.get(partnerMappedId) : undefined;
      if (partnerMember && m.achievements) {
        m.achievements.partnerDefault = partnerMember.name;
        changed = true;
      }
    }

    // If qualifiedTournament is a deleted default tournament name, update to active tournament name
    if (m.qualifiedTournament && LEGACY_TOURNAMENT_NAMES.has(m.qualifiedTournament)) {
      const exists = tournaments.some((t) => t.name === m.qualifiedTournament);
      if (!exists) {
        m.qualifiedTournament = activeTourneyName;
        changed = true;
      }
    }

    if (m.achievements?.tournaments) {
      const updatedTourneyList = m.achievements.tournaments.map((tName) =>
        LEGACY_TOURNAMENT_NAMES.has(tName) && !tournaments.some((t) => t.name === tName)
          ? activeTourneyName
          : tName
      );
      const uniqueList = Array.from(new Set(updatedTourneyList));
      if (JSON.stringify(uniqueList) !== JSON.stringify(m.achievements.tournaments)) {
        m.achievements.tournaments = uniqueList;
        changed = true;
      }
    }

    if (changed) {
      await db.execute({
        sql: `UPDATE members SET nickname = ?, is_group_qualified = ?, qualified_tournament = ?, qualified_phase = ?, achievements = ?, updated_at = ? WHERE id = ?`,
        args: [
          m.nickname || '',
          m.isGroupQualified ? 1 : 0,
          m.qualifiedTournament || '',
          m.qualifiedPhase || '',
          JSON.stringify(m.achievements || { gold: 0, silver: 0, bronze: 0, tournaments: [] }),
          now,
          m.id
        ]
      });
    }
  }

  // Helper to replace legacy player/team names in any string
  const replaceLegacyNamesInString = (text: string): string => {
    if (!text) return text;
    let out = text;

    const m = (id: string) => memberById.get(id)?.name || id;
    const pairReplacements: [RegExp, string][] = [
      [/Tika\s*&\s*Dodie/gi, `${m('LLP-MBR-001')} & ${m('LLP-MBR-002')}`],
      [/Kartika\s*&\s*Dodie(\s*Adam)?/gi, `${m('LLP-MBR-001')} & ${m('LLP-MBR-002')}`],
      [/Kartika(\s*Aditoputro)?\s*\/\s*Dodie(\s*Adam(\s*Pratama)?)?/gi, `${m('LLP-MBR-001')} / ${m('LLP-MBR-002')}`],
      [/Oliv(ia)?\s*&\s*Rico/gi, `${m('LLP-MBR-003')} & ${m('LLP-MBR-004')}`],
      [/Olivia(\s*S\.)?\s*\/\s*Rico(\s*Prasetya)?/gi, `${m('LLP-MBR-003')} / ${m('LLP-MBR-004')}`],
      [/Evan\s*&\s*Ngoe/gi, `${m('LLP-MBR-005')} & ${m('LLP-MBR-006')}`],
      [/Evan(\s*Wirawan)?\s*\/\s*Ngoe(\s*Wijaya)?/gi, `${m('LLP-MBR-005')} / ${m('LLP-MBR-006')}`],
      [/Merry\s*&\s*Fifi/gi, `${m('LLP-MBR-007')} & ${m('LLP-MBR-008')}`],
      [/Merry\s*\/\s*Fifi/gi, `${m('LLP-MBR-007')} / ${m('LLP-MBR-008')}`],
      [/Nia\s*&\s*Sassa(\s*Rizki)?/gi, `${m('LLP-MBR-009')} & ${m('LLP-MBR-010')}`],
      [/Nia\s*\/\s*Sassa(\s*Rizki)?/gi, `${m('LLP-MBR-009')} / ${m('LLP-MBR-010')}`],
      [/(Tina|Christina)\s*&\s*Mega/gi, `${m('LLP-MBR-011')} & ${m('LLP-MBR-012')}`],
      [/(Tina|Christina)\s*\/\s*Mega/gi, `${m('LLP-MBR-011')} / ${m('LLP-MBR-012')}`],
      [/Bagas\s*&\s*Dimas/gi, `${m('LLP-MBR-013')} & ${m('LLP-MBR-014')}`],
      [/Bagas(\s*Pratama)?\s*\/\s*Dimas(\s*Wicaksono)?/gi, `${m('LLP-MBR-013')} / ${m('LLP-MBR-014')}`],
      [/Bimo\s*&\s*Farhan/gi, `${m('LLP-MBR-015')} & ${m('LLP-MBR-016')}`],
      [/Bimo(\s*Prasetyo)?\s*\/\s*Farhan(\s*Hakim)?/gi, `${m('LLP-MBR-015')} / ${m('LLP-MBR-016')}`]
    ];

    for (const [regex, replacement] of pairReplacements) {
      out = out.replace(regex, replacement);
    }

    const singleReplacements: [RegExp, string][] = [
      [/\bKartika Aditoputro\b/gi, m('LLP-MBR-001')],
      [/\bDodie Adam Pratama\b/gi, m('LLP-MBR-002')],
      [/\bDodie Adam\b/gi, m('LLP-MBR-002')],
      [/\bOlivia S\./gi, m('LLP-MBR-003')],
      [/\bRico Prasetya\b/gi, m('LLP-MBR-004')],
      [/\bEvan Wirawan\b/gi, m('LLP-MBR-005')],
      [/\bNgoe Wijaya\b/gi, m('LLP-MBR-006')],
      [/\bSassa Rizki\b/gi, m('LLP-MBR-010')],
      [/\bBagas Pratama\b/gi, m('LLP-MBR-013')],
      [/\bDimas Wicaksono\b/gi, m('LLP-MBR-014')],
      [/\bBimo Prasetyo\b/gi, m('LLP-MBR-015')],
      [/\bFarhan Hakim\b/gi, m('LLP-MBR-016')],
      [/\bKartika\b/gi, m('LLP-MBR-001')],
      [/\bTika\b/gi, m('LLP-MBR-001')],
      [/\bDodie\b/gi, m('LLP-MBR-002')],
      [/\bOlivia\b/gi, m('LLP-MBR-003')],
      [/\bOliv\b/gi, m('LLP-MBR-003')],
      [/\bRico\b/gi, m('LLP-MBR-004')],
      [/\bEvan\b/gi, m('LLP-MBR-005')],
      [/\bNgoe\b/gi, m('LLP-MBR-006')],
      [/\bMerry\b/gi, m('LLP-MBR-007')],
      [/\bFifi\b/gi, m('LLP-MBR-008')],
      [/\bNia\b/gi, m('LLP-MBR-009')],
      [/\bSassa\b/gi, m('LLP-MBR-010')],
      [/\bChristina\b/gi, m('LLP-MBR-011')],
      [/\bTina\b/gi, m('LLP-MBR-011')],
      [/\bMega\b/gi, m('LLP-MBR-012')],
      [/\bBagas\b/gi, m('LLP-MBR-013')],
      [/\bDimas\b/gi, m('LLP-MBR-014')],
      [/\bBimo\b/gi, m('LLP-MBR-015')],
      [/\bFarhan\b/gi, m('LLP-MBR-016')]
    ];

    for (const [regex, replacement] of singleReplacements) {
      out = out.replace(regex, replacement);
    }

    return out;
  };

  // 2. Sync tournament_groups, tournaments, and brackets
  for (const tourney of tournaments) {
    const groupsRes = await db.execute({
      sql: `SELECT pools_json FROM tournament_groups WHERE tournament_id = ?`,
      args: [tourney.id]
    });

    let pools: PoolGroupData[] = [];
    if (groupsRes.rows.length > 0) {
      pools = JSON.parse(groupsRes.rows[0].pools_json as string);
    }

    // Track members already explicitly allocated by admin (non-auto-seeded team IDs)
    const customAllocatedMembers = new Set<string>();
    pools.forEach((pg) => {
      pg.teams.forEach((t) => {
        const isAutoSeedId = /^team-.*-\d+$/.test(t.id);
        if (!isAutoSeedId) {
          if (t.member1Id && memberById.has(t.member1Id)) customAllocatedMembers.add(t.member1Id);
          if (t.member2Id && memberById.has(t.member2Id)) customAllocatedMembers.add(t.member2Id);
        }
      });
    });

    const existingStandings = tourney.groupStandings?.standings || [];
    const hasTourneyMatchesPlayed =
      (tourney.matches && tourney.matches.length > 0) ||
      existingStandings.some((s) => (s.played || 0) > 0);

    // Update each team in pools with current member data and resolve any conflict with custom allocated members
    pools = pools.map((pg) => ({
      ...pg,
      teams: pg.teams
        .filter((t) => {
          const isAutoSeedId = /^team-.*-\d+$/.test(t.id);
          const teamParts = (t.name || '').split(/[&/]/).map((s) => s.trim());
          const m1 = resolveMember(t.member1Id, t.p1, teamParts[0]);
          const m2 = resolveMember(t.member2Id, t.p2, teamParts[1]);
          if (
            isAutoSeedId &&
            ((m1 && customAllocatedMembers.has(m1.id)) || (m2 && customAllocatedMembers.has(m2.id)))
          ) {
            // Remove auto-seeded default team whose member was explicitly allocated to another team by admin
            return false;
          }
          return true;
        })
        .map((t) => {
          const teamParts = (t.name || '').split(/[&/]/).map((s) => s.trim());
          const m1 = resolveMember(t.member1Id, t.p1, teamParts[0]);
          const m2 = resolveMember(t.member2Id, t.p2, teamParts[1]);

          const p1Name = m1 ? m1.name : replaceLegacyNamesInString(t.p1);
          const p2Name = m2 ? m2.name : replaceLegacyNamesInString(t.p2);
          const n1 = m1 ? (m1.nickname || m1.name) : p1Name;
          const n2 = m2 ? (m2.nickname || m2.name) : p2Name;

          const updatedTeamName =
            m1 && m2
              ? `${n1} & ${n2}`
              : m1
              ? n1
              : replaceLegacyNamesInString(t.name);

          const prevStanding = existingStandings.find(
            (s) => s.id === t.id || replaceLegacyNamesInString(s.name) === updatedTeamName
          );
          const teamHasPlayed = hasTourneyMatchesPlayed && (prevStanding?.played || 0) > 0;
          const isQual = teamHasPlayed ? Boolean(t.isQualified) : false;

          return {
            ...t,
            member1Id: m1?.id || t.member1Id,
            member2Id: m2?.id || t.member2Id,
            name: updatedTeamName,
            p1: p1Name,
            p2: p2Name,
            p1Photo: m1?.photoUrl || t.p1Photo,
            p2Photo: m2?.photoUrl || t.p2Photo,
            club: m1?.club || t.club || 'LagiLagi Padel',
            rating:
              m1 && m2
                ? ((parseFloat(m1.rating || '3.0') + parseFloat(m2.rating || '3.0')) / 2).toFixed(1)
                : m1?.rating || t.rating || '3.0',
            pool: pg.poolName,
            isQualified: isQual
          };
        })
    }));

    // Update partnerDefault and qualifiedPool/qualifiedTournament for members based on their actual tournament team pairing
    for (const pg of pools) {
      for (const t of pg.teams) {
        const m1 = t.member1Id ? memberById.get(t.member1Id) : undefined;
        const m2 = t.member2Id ? memberById.get(t.member2Id) : undefined;
        if (m1) {
          let m1Changed = false;
          if (m2 && m1.achievements && m1.achievements.partnerDefault !== m2.name) {
            m1.achievements.partnerDefault = m2.name;
            m1Changed = true;
          }
          if (m1.qualifiedPool !== pg.poolName || m1.qualifiedTournament !== tourney.name) {
            m1.qualifiedPool = pg.poolName;
            m1.qualifiedTournament = tourney.name;
            m1Changed = true;
          }
          if (m1Changed) {
            await db.execute({
              sql: `UPDATE members SET qualified_tournament = ?, qualified_pool = ?, achievements = ?, updated_at = ? WHERE id = ?`,
              args: [m1.qualifiedTournament || '', m1.qualifiedPool || '', JSON.stringify(m1.achievements), now, m1.id]
            });
          }
        }
        if (m2) {
          let m2Changed = false;
          if (m1 && m2.achievements && m2.achievements.partnerDefault !== m1.name) {
            m2.achievements.partnerDefault = m1.name;
            m2Changed = true;
          }
          if (m2.qualifiedPool !== pg.poolName || m2.qualifiedTournament !== tourney.name) {
            m2.qualifiedPool = pg.poolName;
            m2.qualifiedTournament = tourney.name;
            m2Changed = true;
          }
          if (m2Changed) {
            await db.execute({
              sql: `UPDATE members SET qualified_tournament = ?, qualified_pool = ?, achievements = ?, updated_at = ? WHERE id = ?`,
              args: [m2.qualifiedTournament || '', m2.qualifiedPool || '', JSON.stringify(m2.achievements), now, m2.id]
            });
          }
        }
      }
    }

    // Save updated groups and sync tourney.participants + tourney.groupStandings
    await db.execute({
      sql: `INSERT OR REPLACE INTO tournament_groups (tournament_id, pools_json, updated_at) VALUES (?, ?, ?)`,
      args: [tourney.id, JSON.stringify(pools), now]
    });

    // Rebuild participants & standings from pools (preserving per-pool position)
    const flatTeams: { team: any; poolPos: number }[] = [];
    pools.forEach((pg) => {
      pg.teams.forEach((t, poolIdx) => {
        flatTeams.push({ team: { ...t, pool: pg.poolName }, poolPos: poolIdx + 1 });
      });
    });

    tourney.participants = flatTeams.map(({ team: t }, idx) => ({
      seed: t.seed || idx + 1,
      teamName: t.name,
      p1: t.p1,
      p2: t.p2,
      category: tourney.categories?.[0] || 'Ganda Umum',
      club: t.club || 'LagiLagi Padel Club',
      city: 'Solo / Jakarta',
      pool: t.pool,
      rating: t.rating || '3.0',
      status: hasTourneyMatchesPlayed && t.isQualified ? 'Playoff' : 'Confirmed'
    }));

    tourney.groupStandings = {
      pools: ['Semua Pool', ...pools.map((p) => p.poolName)],
      standings: flatTeams.map(({ team: t, poolPos }) => {
        const prev = existingStandings.find(
          (s) => s.id === t.id || replaceLegacyNamesInString(s.name) === t.name
        );
        const playedCount = prev?.played || 0;
        return {
          id: t.id,
          pos: poolPos,
          name: t.name,
          p1: t.p1,
          p2: t.p2,
          pool: t.pool,
          played: playedCount,
          won: prev?.won || 0,
          lost: prev?.lost || 0,
          gamesWon: prev?.gamesWon || 0,
          gamesLost: prev?.gamesLost || 0,
          gameDiff: prev?.gameDiff || 0,
          points: prev?.points || 0,
          isQualified: playedCount > 0 && Boolean(t.isQualified)
        };
      })
    };

    // Sanitize tourney.matches
    if (tourney.matches) {
      tourney.matches = tourney.matches.map((match) => ({
        ...match,
        teamA: replaceLegacyNamesInString(match.teamA),
        playersA: replaceLegacyNamesInString(match.playersA),
        teamB: replaceLegacyNamesInString(match.teamB),
        playersB: replaceLegacyNamesInString(match.playersB),
        setDetail: match.setDetail ? replaceLegacyNamesInString(match.setDetail) : match.setDetail
      }));
    }

    // Sanitize tourney.winners
    if (tourney.winners) {
      if (tourney.winners.notes) {
        tourney.winners.notes = replaceLegacyNamesInString(tourney.winners.notes);
      }
      if (tourney.winners.podium) {
        tourney.winners.podium = tourney.winners.podium.map((w) => ({
          ...w,
          teamName: replaceLegacyNamesInString(w.teamName),
          p1: replaceLegacyNamesInString(w.p1),
          p2: replaceLegacyNamesInString(w.p2),
          finalScore: w.finalScore ? replaceLegacyNamesInString(w.finalScore) : w.finalScore
        }));
      }
      if (tourney.winners.mvp) {
        tourney.winners.mvp.name = replaceLegacyNamesInString(tourney.winners.mvp.name);
      }
    }

    // Sanitize bracket in brackets table and tourney.knockoutBracket
    const bracketRes = await db.execute({
      sql: `SELECT bracket_json FROM brackets WHERE tournament_id = ?`,
      args: [tourney.id]
    });
    let bracket: KnockoutBracketData =
      bracketRes.rows.length > 0
        ? JSON.parse(bracketRes.rows[0].bracket_json as string)
        : tourney.knockoutBracket;

    if (bracket) {
      const cleanMatchNode = (node: any) => {
        if (!node) return node;
        return {
          ...node,
          note: node.note ? replaceLegacyNamesInString(node.note) : node.note,
          team1: node.team1
            ? {
                ...node.team1,
                name: replaceLegacyNamesInString(node.team1.name),
                players: replaceLegacyNamesInString(node.team1.players)
              }
            : node.team1,
          team2: node.team2
            ? {
                ...node.team2,
                name: replaceLegacyNamesInString(node.team2.name),
                players: replaceLegacyNamesInString(node.team2.players)
              }
            : node.team2
        };
      };

      if (bracket.roundOf16) bracket.roundOf16 = bracket.roundOf16.map(cleanMatchNode);
      if (bracket.quarters) bracket.quarters = bracket.quarters.map(cleanMatchNode);
      if (bracket.semis) bracket.semis = bracket.semis.map(cleanMatchNode);
      if (bracket.grandFinal) bracket.grandFinal = cleanMatchNode(bracket.grandFinal);
      if (bracket.bronzeMatch) bracket.bronzeMatch = cleanMatchNode(bracket.bronzeMatch);

      tourney.knockoutBracket = bracket;

      await db.execute({
        sql: `INSERT OR REPLACE INTO brackets (tournament_id, bracket_json, updated_at) VALUES (?, ?, ?)`,
        args: [tourney.id, JSON.stringify(bracket), now]
      });
    }

    await db.execute({
      sql: `INSERT OR REPLACE INTO tournaments (id, name, status, category, date, location, total_prize, data, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        tourney.id,
        tourney.name,
        tourney.status,
        tourney.categories?.[0] || '',
        tourney.date || '',
        tourney.location || '',
        tourney.prizePool || '',
        JSON.stringify(tourney),
        now
      ]
    });
  }

  // 3. Sanitize referee_state
  const refRes = await db.execute({
    sql: `SELECT state_json FROM referee_state WHERE id = ?`,
    args: ['current_state']
  });
  if (refRes.rows.length > 0) {
    const refState: RefereeScoringState = JSON.parse(refRes.rows[0].state_json as string);
    refState.teamAName = replaceLegacyNamesInString(refState.teamAName);
    refState.teamBName = replaceLegacyNamesInString(refState.teamBName);
    if (refState.scoreHistory) {
      refState.scoreHistory = refState.scoreHistory.map(replaceLegacyNamesInString);
    }
    if (refState.selectedTourneyId && !tournaments.some((t) => t.id === refState.selectedTourneyId)) {
      refState.selectedTourneyId = tournaments[0]?.id || '';
    }
    if (refState.selectedTourneyId && refState.matchPhase && refState.matchPhase.toLowerCase().includes('pool')) {
      const targetPool = refState.matchPhase.replace(/\s*Match$/i, '').trim();
      const gRes = await db.execute({
        sql: `SELECT pools_json FROM tournament_groups WHERE tournament_id = ?`,
        args: [refState.selectedTourneyId]
      });
      if (gRes.rows.length > 0) {
        const gPools: PoolGroupData[] = JSON.parse(gRes.rows[0].pools_json as string);
        const matched = gPools.find((p) => p.poolName.toLowerCase() === targetPool.toLowerCase());
        if (matched && matched.teams.length >= 2) {
          const validPoolNames = new Set(matched.teams.map((t) => t.name));
          if (!validPoolNames.has(refState.teamAName)) {
            refState.teamAName = matched.teams[0].name;
          }
          if (!validPoolNames.has(refState.teamBName) || refState.teamBName === refState.teamAName) {
            refState.teamBName = matched.teams.find((t) => t.name !== refState.teamAName)?.name || matched.teams[1].name;
          }
        }
      }
    }
    await db.execute({
      sql: `INSERT OR REPLACE INTO referee_state (id, state_json, updated_at) VALUES (?, ?, ?)`,
      args: ['current_state', JSON.stringify(refState), now]
    });
  }

  await db.execute({
    sql: `INSERT OR REPLACE INTO system_meta (key, value, updated_at) VALUES (?, ?, ?)`,
    args: ['last_sync', now, now]
  });
}

export function extractDefaultGroupsFromTourney(tourney: FullTournamentDetail): PoolGroupData[] {
  let poolNames = tourney?.groupStandings?.pools?.filter((p) => p !== 'Semua Pool') || [];
  if (!poolNames || poolNames.length === 0) {
    poolNames = ['Pool A', 'Pool B', 'Pool C', 'Pool D'];
  }
  const participants = tourney?.participants || [];
  const hasMatchesPlayed = (tourney?.matches?.length || 0) > 0;
  const result: PoolGroupData[] = poolNames.map((poolName) => ({
    poolName,
    teams: []
  }));

  participants.forEach((p, idx) => {
    const targetPoolName = p.pool || poolNames[idx % poolNames.length];
    let poolObj = result.find((pg) => pg.poolName === targetPoolName);
    if (!poolObj) {
      poolObj = { poolName: targetPoolName, teams: [] };
      result.push(poolObj);
    }
    const fallbackId1 = `LLP-MBR-${String((idx * 2) % 16 + 1).padStart(3, '0')}`;
    const fallbackId2 = `LLP-MBR-${String((idx * 2 + 1) % 16 + 1).padStart(3, '0')}`;
    const m1Id = LEGACY_MEMBER_MAP[(p.p1 || '').trim().toLowerCase()] || fallbackId1;
    const m2Id = LEGACY_MEMBER_MAP[(p.p2 || '').trim().toLowerCase()] || fallbackId2;
    poolObj.teams.push({
      id: `team-${tourney.id}-${idx + 1}`,
      name: p.teamName,
      p1: p.p1,
      p2: p.p2,
      member1Id: m1Id,
      member2Id: m2Id,
      club: p.club,
      rating: p.rating,
      pool: poolObj.poolName,
      seed: p.seed,
      isQualified: hasMatchesPlayed && p.status === 'Playoff'
    });
  });

  return result;
}

/**
 * Seed all default initial tournaments, club members, brackets, and pools into SQLite.
 */
export async function seedDefaultData(): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  // 1. Seed Tournaments
  for (const t of Object.values(PADEL_TOURNAMENTS_DATA)) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO tournaments (id, name, status, category, date, location, total_prize, data, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        t.id,
        t.name,
        t.status,
        t.categories?.[0] || '',
        t.date || '',
        t.location || '',
        t.prizePool || '',
        JSON.stringify(t),
        now
      ]
    });

    // Seed default bracket for each tournament
    const bracket = t.knockoutBracket || getStoredBracket(t.id);
    await db.execute({
      sql: `INSERT OR REPLACE INTO brackets (tournament_id, bracket_json, updated_at) VALUES (?, ?, ?)`,
      args: [t.id, JSON.stringify(bracket), now]
    });

    // Seed default groups for each tournament
    const groups = extractDefaultGroupsFromTourney(t);
    await db.execute({
      sql: `INSERT OR REPLACE INTO tournament_groups (tournament_id, pools_json, updated_at) VALUES (?, ?, ?)`,
      args: [t.id, JSON.stringify(groups), now]
    });
  }

  // 2. Seed Club Members
  for (const m of DEFAULT_CLUB_MEMBERS) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO members (
        id, name, nickname, photo_url, phone, email, club, city, rating, gender,
        membership_tier, joined_date, status, is_group_qualified, qualified_tournament,
        qualified_pool, qualified_phase, achievements, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        m.id,
        m.name,
        m.nickname || '',
        m.photoUrl || '',
        m.phone || '',
        m.email || '',
        m.club || '',
        m.city || '',
        m.rating || '3.0',
        m.gender || 'Mix',
        m.membershipTier || 'Rookie',
        m.joinedDate || '01 Jan 2026',
        m.status || 'Aktif',
        m.isGroupQualified ? 1 : 0,
        m.qualifiedTournament || '',
        m.qualifiedPool || '',
        m.qualifiedPhase || '',
        JSON.stringify(m.achievements || { gold: 0, silver: 0, bronze: 0, tournaments: [] }),
        now
      ]
    });
  }

  // 3. Seed Referee State
  await db.execute({
    sql: `INSERT OR REPLACE INTO referee_state (id, state_json, updated_at) VALUES (?, ?, ?)`,
    args: ['current_state', JSON.stringify(DEFAULT_REFEREE_STATE), now]
  });

  // 4. Update Meta
  await db.execute({
    sql: `INSERT OR REPLACE INTO system_meta (key, value, updated_at) VALUES (?, ?, ?)`,
    args: ['last_sync', now, now]
  });

  console.log('[SQLite] Seeding completed successfully.');
}

/**
 * Reset all system tables to clean empty state or re-seed default data.
 */
export async function resetDatabase(cleanSlate = false): Promise<void> {
  const db = getDb();
  await db.execute(`DELETE FROM tournaments`);
  await db.execute(`DELETE FROM members`);
  await db.execute(`DELETE FROM tournament_groups`);
  await db.execute(`DELETE FROM brackets`);
  await db.execute(`DELETE FROM referee_state`);

  if (!cleanSlate) {
    await seedDefaultData();
  } else {
    const now = new Date().toISOString();
    await db.execute({
      sql: `INSERT OR REPLACE INTO system_meta (key, value, updated_at) VALUES (?, ?, ?)`,
      args: ['last_sync', now, now]
    });
  }
}

// ----------------- CRUD HELPERS ----------------- //

export async function getAllTournaments(): Promise<FullTournamentDetail[]> {
  const db = getDb();
  const res = await db.execute(`SELECT data FROM tournaments ORDER BY updated_at DESC`);
  return res.rows.map((row) => JSON.parse(row.data as string));
}

export async function getTournamentById(id: string): Promise<FullTournamentDetail | null> {
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT data FROM tournaments WHERE id = ?`,
    args: [id]
  });
  if (res.rows.length === 0) return null;
  return JSON.parse(res.rows[0].data as string);
}

export async function saveOrUpdateTournament(tourney: FullTournamentDetail): Promise<FullTournamentDetail> {
  const db = getDb();
  const now = new Date().toISOString();
  
  // Check if exists to preserve fields if partial
  const existing = await getTournamentById(tourney.id);
  const merged: FullTournamentDetail = existing ? { ...existing, ...tourney } : tourney;

  await db.execute({
    sql: `INSERT OR REPLACE INTO tournaments (id, name, status, category, date, location, total_prize, data, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      merged.id,
      merged.name,
      merged.status,
      merged.categories?.[0] || '',
      merged.date || '',
      merged.location || '',
      merged.prizePool || '',
      JSON.stringify(merged),
      now
    ]
  });

  await db.execute({
    sql: `INSERT OR REPLACE INTO system_meta (key, value, updated_at) VALUES (?, ?, ?)`,
    args: ['tournaments_updated', now, now]
  });

  return merged;
}

export async function deleteTournamentById(id: string): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `DELETE FROM tournaments WHERE id = ?`,
    args: [id]
  });
  await db.execute({
    sql: `DELETE FROM tournament_groups WHERE tournament_id = ?`,
    args: [id]
  });
  await db.execute({
    sql: `DELETE FROM brackets WHERE tournament_id = ?`,
    args: [id]
  });
  await db.execute({
    sql: `INSERT OR REPLACE INTO system_meta (key, value, updated_at) VALUES (?, ?, ?)`,
    args: ['tournaments_updated', now, now]
  });
  return true;
}

export async function updateTournamentQuickStatus(id: string, status: 'Live' | 'Akan Datang' | 'Selesai'): Promise<FullTournamentDetail | null> {
  const tourney = await getTournamentById(id);
  if (!tourney) return null;
  tourney.status = status;
  return saveOrUpdateTournament(tourney);
}

// ----------------- CLUB MEMBERS ----------------- //

export async function getAllMembers(): Promise<ClubMember[]> {
  const db = getDb();
  const res = await db.execute(`SELECT * FROM members ORDER BY id ASC`);
  return res.rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    nickname: (row.nickname as string) || undefined,
    photoUrl: (row.photo_url as string) || '',
    phone: (row.phone as string) || '',
    email: (row.email as string) || '',
    club: (row.club as string) || '',
    city: (row.city as string) || '',
    rating: (row.rating as string) || '3.0',
    gender: (row.gender as any) || 'Mix',
    membershipTier: (row.membership_tier as any) || 'Rookie',
    joinedDate: (row.joined_date as string) || '',
    status: (row.status as any) || 'Aktif',
    isGroupQualified: Boolean(row.is_group_qualified),
    qualifiedTournament: (row.qualified_tournament as string) || undefined,
    qualifiedPool: (row.qualified_pool as string) || undefined,
    qualifiedPhase: (row.qualified_phase as string) || undefined,
    achievements: row.achievements ? JSON.parse(row.achievements as string) : { gold: 0, silver: 0, bronze: 0, tournaments: [] }
  }));
}

export async function saveOrUpdateMember(m: ClubMember): Promise<ClubMember> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT OR REPLACE INTO members (
      id, name, nickname, photo_url, phone, email, club, city, rating, gender,
      membership_tier, joined_date, status, is_group_qualified, qualified_tournament,
      qualified_pool, qualified_phase, achievements, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      m.id,
      m.name,
      m.nickname || '',
      m.photoUrl || '',
      m.phone || '',
      m.email || '',
      m.club || '',
      m.city || '',
      m.rating || '3.0',
      m.gender || 'Mix',
      m.membershipTier || 'Rookie',
      m.joinedDate || '01 Jan 2026',
      m.status || 'Aktif',
      m.isGroupQualified ? 1 : 0,
      m.qualifiedTournament || '',
      m.qualifiedPool || '',
      m.qualifiedPhase || '',
      JSON.stringify(m.achievements || { gold: 0, silver: 0, bronze: 0, tournaments: [] }),
      now
    ]
  });

  await syncAllDataWithMembers();

  await db.execute({
    sql: `INSERT OR REPLACE INTO system_meta (key, value, updated_at) VALUES (?, ?, ?)`,
    args: ['members_updated', now, now]
  });

  return m;
}

export async function deleteMemberById(id: string): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `DELETE FROM members WHERE id = ?`,
    args: [id]
  });
  await db.execute({
    sql: `INSERT OR REPLACE INTO system_meta (key, value, updated_at) VALUES (?, ?, ?)`,
    args: ['members_updated', now, now]
  });
  return true;
}

// ----------------- GROUPS & POOLS ----------------- //

export async function getTournamentGroups(tournamentId: string): Promise<PoolGroupData[]> {
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT pools_json FROM tournament_groups WHERE tournament_id = ?`,
    args: [tournamentId]
  });
  if (res.rows.length === 0) {
    // Generate default from tournament in SQLite
    const tourney = await getTournamentById(tournamentId);
    const def = tourney ? extractDefaultGroupsFromTourney(tourney) : [];
    if (def.length > 0) {
      await saveTournamentGroups(tournamentId, def);
    }
    return def;
  }
  return JSON.parse(res.rows[0].pools_json as string);
}

export async function saveTournamentGroups(tournamentId: string, pools: PoolGroupData[]): Promise<PoolGroupData[]> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT OR REPLACE INTO tournament_groups (tournament_id, pools_json, updated_at) VALUES (?, ?, ?)`,
    args: [tournamentId, JSON.stringify(pools), now]
  });

  // Also update tournament.participants & groupStandings in tournament table to keep in sync!
  const tourney = await getTournamentById(tournamentId);
  if (tourney) {
    const flatTeams: { team: any; poolPos: number }[] = [];
    pools.forEach((pg) => {
      pg.teams.forEach((t, poolIdx) => {
        flatTeams.push({ team: { ...t, pool: pg.poolName }, poolPos: poolIdx + 1 });
      });
    });

    tourney.participants = flatTeams.map(({ team: t }, idx) => ({
      seed: t.seed || idx + 1,
      teamName: t.name,
      p1: t.p1,
      p2: t.p2,
      category: tourney.categories?.[0] || 'Ganda Umum',
      club: t.club || 'LagiLagi Padel Club',
      city: 'Solo / Jakarta',
      pool: t.pool,
      rating: t.rating || '3.0',
      status: t.isQualified ? 'Playoff' : 'Confirmed'
    }));

    const existingStandings = tourney.groupStandings?.standings || [];
    tourney.groupStandings = {
      pools: ['Semua Pool', ...pools.map((p) => p.poolName)],
      standings: flatTeams.map(({ team: t, poolPos }) => {
        const prev = existingStandings.find((s) => s.id === t.id || s.name === t.name);
        return {
          id: t.id,
          pos: poolPos,
          name: t.name,
          p1: t.p1,
          p2: t.p2,
          pool: t.pool,
          played: prev?.played || 0,
          won: prev?.won || 0,
          lost: prev?.lost || 0,
          gamesWon: prev?.gamesWon || 0,
          gamesLost: prev?.gamesLost || 0,
          gameDiff: prev?.gameDiff || 0,
          points: prev?.points || 0,
          isQualified: Boolean(t.isQualified)
        };
      })
    };
    await saveOrUpdateTournament(tourney);
  }

  await syncAllDataWithMembers();

  await db.execute({
    sql: `INSERT OR REPLACE INTO system_meta (key, value, updated_at) VALUES (?, ?, ?)`,
    args: [`groups_${tournamentId}`, now, now]
  });

  const refreshed = await db.execute({
    sql: `SELECT pools_json FROM tournament_groups WHERE tournament_id = ?`,
    args: [tournamentId]
  });
  return refreshed.rows.length > 0 ? JSON.parse(refreshed.rows[0].pools_json as string) : pools;
}

export interface AssignMemberPayload {
  tournamentId: string;
  targetPool: string;
  member1Id: string;
  member2Id?: string;
  customTeamName?: string;
  seed?: number;
}

export async function assignMemberToPool(payload: AssignMemberPayload): Promise<PoolGroupData[]> {
  const { tournamentId, targetPool, member1Id, member2Id, customTeamName, seed } = payload;
  const groups = await getTournamentGroups(tournamentId);
  const members = await getAllMembers();

  const m1 = members.find((m) => m.id === member1Id);
  const m2 = member2Id ? members.find((m) => m.id === member2Id) : null;

  if (!m1) {
    throw new Error('Member utama tidak ditemukan dalam database.');
  }

  const p1Name = m1.name;
  const p2Name = m2 ? m2.name : (m1.achievements?.partnerDefault || 'Partner TBD');
  const teamName = customTeamName || (m2 ? `${m1.nickname || m1.name.split(' ')[0]} & ${m2.nickname || m2.name.split(' ')[0]}` : m1.name);
  const combinedRating = m2 ? ((parseFloat(m1.rating || '3.0') + parseFloat(m2.rating || '3.0')) / 2).toFixed(1) : m1.rating;

  // Remove existing team with same member1 if already assigned anywhere in this tournament
  let updatedPools = groups.map((g) => ({
    ...g,
    teams: g.teams.filter((t) => t.member1Id !== member1Id && (!member2Id || t.member2Id !== member2Id))
  }));

  // Ensure target pool exists
  let targetPoolObj = updatedPools.find((g) => g.poolName.toLowerCase() === targetPool.toLowerCase());
  if (!targetPoolObj) {
    targetPoolObj = { poolName: targetPool, teams: [] };
    updatedPools.push(targetPoolObj);
  }

  // Create new team item
  const newTeam = {
    id: `team-${tournamentId}-${Date.now().toString(36)}`,
    name: teamName,
    p1: p1Name,
    p2: p2Name,
    member1Id: m1.id,
    member2Id: m2?.id,
    p1Photo: m1.photoUrl,
    p2Photo: m2?.photoUrl,
    club: m1.club || 'LagiLagi Padel',
    rating: combinedRating,
    pool: targetPoolObj.poolName,
    seed: seed || undefined,
    isQualified: false
  };

  targetPoolObj.teams.push(newTeam);

  return saveTournamentGroups(tournamentId, updatedPools);
}

// ----------------- BRACKETS ----------------- //

export async function getTournamentBracket(tournamentId: string): Promise<KnockoutBracketData> {
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT bracket_json FROM brackets WHERE tournament_id = ?`,
    args: [tournamentId]
  });
  if (res.rows.length === 0) {
    const def = getStoredBracket(tournamentId);
    await saveTournamentBracket(tournamentId, def);
    return def;
  }
  return JSON.parse(res.rows[0].bracket_json as string);
}

export async function saveTournamentBracket(tournamentId: string, bracket: KnockoutBracketData): Promise<KnockoutBracketData> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT OR REPLACE INTO brackets (tournament_id, bracket_json, updated_at) VALUES (?, ?, ?)`,
    args: [tournamentId, JSON.stringify(bracket), now]
  });

  // Also sync into tournament object
  const tourney = await getTournamentById(tournamentId);
  if (tourney) {
    tourney.knockoutBracket = bracket;
    await saveOrUpdateTournament(tourney);
  }

  await db.execute({
    sql: `INSERT OR REPLACE INTO system_meta (key, value, updated_at) VALUES (?, ?, ?)`,
    args: [`bracket_${tournamentId}`, now, now]
  });

  return bracket;
}

// ----------------- REFEREE LIVE SCORING ----------------- //

export async function getLiveRefereeState(): Promise<RefereeScoringState> {
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT state_json FROM referee_state WHERE id = ?`,
    args: ['current_state']
  });
  if (res.rows.length === 0) {
    await saveLiveRefereeState(DEFAULT_REFEREE_STATE);
    return DEFAULT_REFEREE_STATE;
  }
  return JSON.parse(res.rows[0].state_json as string);
}

export async function saveLiveRefereeState(state: RefereeScoringState): Promise<RefereeScoringState> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT OR REPLACE INTO referee_state (id, state_json, updated_at) VALUES (?, ?, ?)`,
    args: ['current_state', JSON.stringify(state), now]
  });

  await db.execute({
    sql: `INSERT OR REPLACE INTO system_meta (key, value, updated_at) VALUES (?, ?, ?)`,
    args: ['referee_updated', now, now]
  });

  return state;
}

// ----------------- SYSTEM STATUS & SYNC ----------------- //

export async function getSystemSyncSummary(): Promise<{
  tournamentsCount: number;
  membersCount: number;
  lastUpdated: string;
  meta: Record<string, string>;
}> {
  const db = getDb();
  const tCount = await db.execute(`SELECT COUNT(*) as cnt FROM tournaments`);
  const mCount = await db.execute(`SELECT COUNT(*) as cnt FROM members`);
  const metas = await db.execute(`SELECT key, value, updated_at FROM system_meta`);

  const metaObj: Record<string, string> = {};
  let latestUpdate = new Date(0).toISOString();

  metas.rows.forEach((r) => {
    metaObj[r.key as string] = r.value as string;
    const upd = r.updated_at as string;
    if (upd > latestUpdate) latestUpdate = upd;
  });

  return {
    tournamentsCount: Number(tCount.rows[0]?.cnt || 0),
    membersCount: Number(mCount.rows[0]?.cnt || 0),
    lastUpdated: latestUpdate,
    meta: metaObj
  };
}
