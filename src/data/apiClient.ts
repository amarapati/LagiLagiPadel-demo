import { FullTournamentDetail } from './padelProTournamentsData';
import { ClubMember } from './clubMembersStorage';
import { PoolGroupData } from './tournamentGroupStorage';
import { KnockoutBracketData } from './bracketStorage';
import { RefereeScoringState } from './refereeStorage';

// Local storage backup keys for offline resilience
const TOURNAMENTS_KEY = 'lagilagipadel_custom_tournaments';
const MEMBERS_KEY = 'lagilagipadel_club_members';
const GROUPS_PREFIX = 'lagilagipadel_groups_';
const BRACKET_PREFIX = 'lagilagipadel_bracket_';
const REFEREE_KEY = 'lagilagipadel_referee_state';

let lastKnownServerSync: string = '';
let isSyncing = false;
let serverOnline = true;

export interface ServerSyncStatus {
  online: boolean;
  lastSyncTime: string;
  tournamentsCount: number;
  membersCount: number;
}

let syncStatusListeners: ((status: ServerSyncStatus) => void)[] = [];

export function subscribeToSyncStatus(listener: (status: ServerSyncStatus) => void) {
  syncStatusListeners.push(listener);
  return () => {
    syncStatusListeners = syncStatusListeners.filter((l) => l !== listener);
  };
}

function notifySyncStatus(status: ServerSyncStatus) {
  syncStatusListeners.forEach((l) => l(status));
}

// ----------------- TOURNAMENTS API ----------------- //

export async function apiFetchTournaments(): Promise<FullTournamentDetail[]> {
  try {
    const res = await fetch('/api/tournaments');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data: FullTournamentDetail[] = await res.json();
    localStorage.setItem(TOURNAMENTS_KEY, JSON.stringify(data));
    serverOnline = true;
    return data;
  } catch (err) {
    console.warn('[Sync] Falling back to local cache for tournaments:', err);
    serverOnline = false;
    const cached = localStorage.getItem(TOURNAMENTS_KEY);
    return cached ? JSON.parse(cached) : [];
  }
}

export async function apiSaveTournament(tourney: FullTournamentDetail): Promise<FullTournamentDetail> {
  // Optimistically update local
  try {
    const raw = localStorage.getItem(TOURNAMENTS_KEY);
    const list: FullTournamentDetail[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((t) => t.id === tourney.id);
    if (idx >= 0) list[idx] = tourney;
    else list.unshift(tourney);
    localStorage.setItem(TOURNAMENTS_KEY, JSON.stringify(list));
  } catch (e) {}

  try {
    const res = await fetch('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tourney)
    });
    if (!res.ok) throw new Error(`Failed to save tournament: ${res.statusText}`);
    const saved = await res.json();
    window.dispatchEvent(new CustomEvent('lagilagipadel_tournaments_updated', { detail: { tournaments: [saved] } }));
    return saved;
  } catch (err) {
    console.error('[API] Error saving tournament to server:', err);
    window.dispatchEvent(new CustomEvent('lagilagipadel_tournaments_updated', { detail: { tournaments: [] } }));
    return tourney;
  }
}

export async function apiDeleteTournament(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/tournaments/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete tournament: ${res.statusText}`);
    
    // Update local cache
    const raw = localStorage.getItem(TOURNAMENTS_KEY);
    if (raw) {
      const list: FullTournamentDetail[] = JSON.parse(raw);
      localStorage.setItem(TOURNAMENTS_KEY, JSON.stringify(list.filter((t) => t.id !== id)));
    }
    window.dispatchEvent(new CustomEvent('lagilagipadel_tournaments_updated', { detail: { deletedId: id } }));
    return true;
  } catch (err) {
    console.error('[API] Error deleting tournament:', err);
    return false;
  }
}

export async function apiUpdateTournamentStatus(id: string, status: 'Live' | 'Akan Datang' | 'Selesai'): Promise<FullTournamentDetail | null> {
  try {
    const res = await fetch(`/api/tournaments/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error(`Failed to update status`);
    const updated = await res.json();
    window.dispatchEvent(new CustomEvent('lagilagipadel_tournaments_updated', { detail: { updatedTournament: updated } }));
    return updated;
  } catch (err) {
    console.error('[API] Error updating tournament status:', err);
    return null;
  }
}

// ----------------- CLUB MEMBERS API ----------------- //

export async function apiFetchMembers(): Promise<ClubMember[]> {
  try {
    const res = await fetch('/api/members');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data: ClubMember[] = await res.json();
    localStorage.setItem(MEMBERS_KEY, JSON.stringify(data));
    serverOnline = true;
    return data;
  } catch (err) {
    console.warn('[Sync] Falling back to local cache for members:', err);
    serverOnline = false;
    const cached = localStorage.getItem(MEMBERS_KEY);
    return cached ? JSON.parse(cached) : [];
  }
}

export async function apiSaveMember(member: ClubMember): Promise<ClubMember> {
  try {
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(member)
    });
    if (!res.ok) throw new Error(`Failed to save member: ${res.statusText}`);
    const saved = await res.json();
    
    // Update local cache
    const members = await apiFetchMembers();
    window.dispatchEvent(new CustomEvent('lagilagipadel_members_updated', { detail: { members } }));
    return saved;
  } catch (err) {
    console.error('[API] Error saving member:', err);
    return member;
  }
}

export async function apiDeleteMember(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/members/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete member`);
    const members = await apiFetchMembers();
    window.dispatchEvent(new CustomEvent('lagilagipadel_members_updated', { detail: { members } }));
    return true;
  } catch (err) {
    console.error('[API] Error deleting member:', err);
    return false;
  }
}

// ----------------- TOURNAMENT GROUPS & ALLOCATION API ----------------- //

export async function apiFetchGroups(tournamentId: string): Promise<PoolGroupData[]> {
  if (!tournamentId) return [];
  try {
    const res = await fetch(`/api/groups/${tournamentId}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data: PoolGroupData[] = await res.json();
    localStorage.setItem(`${GROUPS_PREFIX}${tournamentId}`, JSON.stringify(data));
    return data;
  } catch (err) {
    console.warn(`[Sync] Fallback to cache for groups ${tournamentId}:`, err);
    const cached = localStorage.getItem(`${GROUPS_PREFIX}${tournamentId}`);
    return cached ? JSON.parse(cached) : [];
  }
}

export async function apiSaveGroups(tournamentId: string, pools: PoolGroupData[]): Promise<PoolGroupData[]> {
  localStorage.setItem(`${GROUPS_PREFIX}${tournamentId}`, JSON.stringify(pools));
  try {
    const res = await fetch(`/api/groups/${tournamentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pools })
    });
    if (!res.ok) throw new Error(`Failed to save groups: ${res.statusText}`);
    const saved = await res.json();
    window.dispatchEvent(new CustomEvent('lagilagipadel_groups_updated', { detail: { tournamentId, pools: saved } }));
    return saved;
  } catch (err) {
    console.error('[API] Error saving groups:', err);
    window.dispatchEvent(new CustomEvent('lagilagipadel_groups_updated', { detail: { tournamentId, pools } }));
    return pools;
  }
}

export interface AssignMemberApiParams {
  tournamentId: string;
  targetPool: string;
  member1Id: string;
  member2Id?: string;
  customTeamName?: string;
  seed?: number;
}

export async function apiAssignMemberToPool(params: AssignMemberApiParams): Promise<PoolGroupData[]> {
  try {
    const res = await fetch(`/api/groups/${params.tournamentId}/assign-member`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Gagal menaruh member ke pool.');
    }
    const data = await res.json();
    const updatedPools = data.pools;
    localStorage.setItem(`${GROUPS_PREFIX}${params.tournamentId}`, JSON.stringify(updatedPools));
    window.dispatchEvent(new CustomEvent('lagilagipadel_groups_updated', { detail: { tournamentId: params.tournamentId, pools: updatedPools } }));
    return updatedPools;
  } catch (err) {
    console.error('[API] Error assigning member to pool:', err);
    throw err;
  }
}

export async function apiRemoveTeamFromPool(tournamentId: string, teamId: string): Promise<PoolGroupData[]> {
  try {
    const res = await fetch(`/api/groups/${tournamentId}/remove-team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId })
    });
    if (!res.ok) throw new Error('Failed to remove team');
    const data = await res.json();
    localStorage.setItem(`${GROUPS_PREFIX}${tournamentId}`, JSON.stringify(data.pools));
    window.dispatchEvent(new CustomEvent('lagilagipadel_groups_updated', { detail: { tournamentId, pools: data.pools } }));
    return data.pools;
  } catch (err) {
    console.error('[API] Error removing team:', err);
    throw err;
  }
}

export async function apiMoveTeamToPool(tournamentId: string, teamId: string, targetPool: string): Promise<PoolGroupData[]> {
  try {
    const res = await fetch(`/api/groups/${tournamentId}/move-team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, targetPool })
    });
    if (!res.ok) throw new Error('Failed to move team');
    const data = await res.json();
    localStorage.setItem(`${GROUPS_PREFIX}${tournamentId}`, JSON.stringify(data.pools));
    window.dispatchEvent(new CustomEvent('lagilagipadel_groups_updated', { detail: { tournamentId, pools: data.pools } }));
    return data.pools;
  } catch (err) {
    console.error('[API] Error moving team:', err);
    throw err;
  }
}

// ----------------- BRACKETS API ----------------- //

export async function apiFetchBracket(tournamentId: string): Promise<KnockoutBracketData> {
  if (!tournamentId) throw new Error('tournamentId required');
  try {
    const res = await fetch(`/api/brackets/${tournamentId}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data: KnockoutBracketData = await res.json();
    localStorage.setItem(`${BRACKET_PREFIX}${tournamentId}`, JSON.stringify(data));
    return data;
  } catch (err) {
    console.warn(`[Sync] Fallback to cache for bracket ${tournamentId}:`, err);
    const cached = localStorage.getItem(`${BRACKET_PREFIX}${tournamentId}`);
    if (cached) return JSON.parse(cached);
    throw err;
  }
}

export async function apiSaveBracket(tournamentId: string, bracket: KnockoutBracketData): Promise<KnockoutBracketData> {
  localStorage.setItem(`${BRACKET_PREFIX}${tournamentId}`, JSON.stringify(bracket));
  try {
    const res = await fetch(`/api/brackets/${tournamentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bracket })
    });
    if (!res.ok) throw new Error(`Failed to save bracket: ${res.statusText}`);
    const saved = await res.json();
    window.dispatchEvent(new CustomEvent('lagilagipadel_bracket_updated', { detail: { tournamentId, bracket: saved } }));
    return saved;
  } catch (err) {
    console.error('[API] Error saving bracket to server:', err);
    window.dispatchEvent(new CustomEvent('lagilagipadel_bracket_updated', { detail: { tournamentId, bracket } }));
    return bracket;
  }
}

// ----------------- REFEREE LIVE SCORING API ----------------- //

export async function apiFetchRefereeState(): Promise<RefereeScoringState> {
  try {
    const res = await fetch('/api/referee/state');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data: RefereeScoringState = await res.json();
    localStorage.setItem(REFEREE_KEY, JSON.stringify(data));
    return data;
  } catch (err) {
    const cached = localStorage.getItem(REFEREE_KEY);
    if (cached) return JSON.parse(cached);
    throw err;
  }
}

export async function apiSaveRefereeState(state: RefereeScoringState): Promise<RefereeScoringState> {
  localStorage.setItem(REFEREE_KEY, JSON.stringify(state));
  try {
    const res = await fetch('/api/referee/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
    if (!res.ok) throw new Error(`Failed to save referee state`);
    const saved = await res.json();
    window.dispatchEvent(new CustomEvent('lagilagipadel_referee_state_changed', { detail: saved }));
    return saved;
  } catch (err) {
    console.error('[API] Error saving referee state:', err);
    return state;
  }
}

// ----------------- SYSTEM RESET & SEED API ----------------- //

export async function apiResetSystem(cleanSlate = false): Promise<void> {
  try {
    const res = await fetch('/api/system/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cleanSlate })
    });
    if (!res.ok) throw new Error('Failed to reset system');
    
    // Clear local storage
    if (cleanSlate) {
      localStorage.clear();
    }
    // Refetch all and dispatch
    await apiFetchTournaments();
    await apiFetchMembers();
    window.dispatchEvent(new CustomEvent('lagilagipadel_tournaments_updated', { detail: {} }));
    window.dispatchEvent(new CustomEvent('lagilagipadel_members_updated', { detail: {} }));
    window.dispatchEvent(new CustomEvent('lagilagipadel_scoring_reset', { detail: { resetToEmpty: cleanSlate } }));
  } catch (err) {
    console.error('[API] Reset system failed:', err);
  }
}

export async function apiSeedDefault(): Promise<void> {
  try {
    const res = await fetch('/api/system/seed', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to seed system');
    await apiFetchTournaments();
    await apiFetchMembers();
    window.dispatchEvent(new CustomEvent('lagilagipadel_tournaments_updated', { detail: {} }));
    window.dispatchEvent(new CustomEvent('lagilagipadel_members_updated', { detail: {} }));
    window.dispatchEvent(new CustomEvent('lagilagipadel_scoring_reset', { detail: { resetToDefault: true } }));
  } catch (err) {
    console.error('[API] Seed default failed:', err);
  }
}

// ----------------- BACKGROUND MULTI-DEVICE REAL-TIME SYNC ----------------- //

let pollInterval: any = null;

export function startBackgroundSync(intervalMs = 2500): () => void {
  if (pollInterval) return () => {};

  const checkSync = async () => {
    if (isSyncing) return;
    isSyncing = true;
    try {
      const res = await fetch('/api/sync/summary');
      if (!res.ok) throw new Error('Sync endpoint down');
      const data = await res.json();
      serverOnline = true;

      notifySyncStatus({
        online: true,
        lastSyncTime: data.lastUpdated || new Date().toISOString(),
        tournamentsCount: data.tournamentsCount,
        membersCount: data.membersCount
      });

      if (data.lastUpdated && data.lastUpdated !== lastKnownServerSync) {
        lastKnownServerSync = data.lastUpdated;
        
        // Data has changed on the server (by another device or admin)!
        // Pull fresh tournaments, members, and referee state
        const [freshTourneys, freshMembers, freshReferee] = await Promise.all([
          apiFetchTournaments(),
          apiFetchMembers(),
          apiFetchRefereeState()
        ]);

        // Also pull fresh groups and brackets for each tournament
        await Promise.all(
          freshTourneys.map(async (t) => {
            try {
              const [pools, bracket] = await Promise.all([
                apiFetchGroups(t.id),
                apiFetchBracket(t.id)
              ]);
              window.dispatchEvent(
                new CustomEvent('lagilagipadel_groups_updated', { detail: { tournamentId: t.id, pools } })
              );
              window.dispatchEvent(
                new CustomEvent('lagilagipadel_bracket_updated', { detail: { tournamentId: t.id, bracket } })
              );
            } catch (e) {}
          })
        );

        window.dispatchEvent(new CustomEvent('lagilagipadel_tournaments_updated', { detail: { tournaments: freshTourneys } }));
        window.dispatchEvent(new CustomEvent('lagilagipadel_members_updated', { detail: { members: freshMembers } }));
        window.dispatchEvent(new CustomEvent('lagilagipadel_referee_state_changed', { detail: freshReferee }));
      }
    } catch (err) {
      serverOnline = false;
      notifySyncStatus({
        online: false,
        lastSyncTime: new Date().toISOString(),
        tournamentsCount: 0,
        membersCount: 0
      });
    } finally {
      isSyncing = false;
    }
  };

  // Run immediately then periodically
  checkSync();
  pollInterval = setInterval(checkSync, intervalMs);

  return () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };
}
