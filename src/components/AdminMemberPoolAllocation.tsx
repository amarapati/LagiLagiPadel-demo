import React, { useState, useEffect } from 'react';
import {
  Users,
  Layers,
  Plus,
  Trash2,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Shield,
  Star,
  RefreshCw,
  Search,
  Database,
  Shuffle,
  ChevronDown,
  ArrowLeftRight
} from 'lucide-react';
import { FullTournamentDetail } from '../data/padelProTournamentsData';
import { getStoredTournaments } from '../data/tournamentStorage';
import { getStoredMembers, ClubMember, lookupPlayerPhoto } from '../data/clubMembersStorage';
import {
  PoolGroupData,
  GroupTeamItem,
  getStoredTournamentGroups,
  saveStoredTournamentGroups,
  randomizeTeamsToPools
} from '../data/tournamentGroupStorage';
import {
  apiAssignMemberToPool,
  apiRemoveTeamFromPool,
  apiMoveTeamToPool,
  apiFetchGroups,
  apiSaveGroups
} from '../data/apiClient';

interface AdminMemberPoolAllocationProps {
  initialTournamentId?: string;
  onAllocationChanged?: () => void;
}

export const AdminMemberPoolAllocation: React.FC<AdminMemberPoolAllocationProps> = ({
  initialTournamentId = 'rookie-mix',
  onAllocationChanged
}) => {
  const [tournaments, setTournaments] = useState<FullTournamentDetail[]>(() => getStoredTournaments());
  const [selectedTourneyId, setSelectedTourneyId] = useState<string>(initialTournamentId);
  const [members, setMembers] = useState<ClubMember[]>(() => getStoredMembers());
  const [pools, setPools] = useState<PoolGroupData[]>(() => getStoredTournamentGroups(initialTournamentId));

  // Form State for placing members into pool
  const [selectedMember1Id, setSelectedMember1Id] = useState<string>('');
  const [selectedMember2Id, setSelectedMember2Id] = useState<string>('');
  const [customTeamName, setCustomTeamName] = useState<string>('');
  const [targetPool, setTargetPool] = useState<string>('Pool A');
  const [teamSeed, setTeamSeed] = useState<string>('0');
  const [memberSearchTerm, setMemberSearchTerm] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // New Pool Creator
  const [newPoolName, setNewPoolName] = useState<string>('');
  const [showAddPoolInput, setShowAddPoolInput] = useState<boolean>(false);

  // Toast / Alert Feedback
  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlertInfo({ type, message });
    setTimeout(() => setAlertInfo(null), 4000);
  };

  // Sync when initialTournamentId prop changes
  useEffect(() => {
    if (initialTournamentId) {
      setSelectedTourneyId(initialTournamentId);
    }
  }, [initialTournamentId]);

  // Load tournament pools when tournament changes
  useEffect(() => {
    const currentPools = getStoredTournamentGroups(selectedTourneyId);
    setPools(currentPools);
    if (currentPools.length > 0 && !currentPools.some((p) => p.poolName === targetPool)) {
      setTargetPool(currentPools[0].poolName);
    }

    // Also fetch fresh from SQLite REST API
    apiFetchGroups(selectedTourneyId)
      .then((data) => {
        if (data && data.length > 0) {
          setPools(data);
        }
      })
      .catch((err) => console.warn('Could not fetch groups from API:', err));
  }, [selectedTourneyId]);

  // Reactive listeners for global updates
  useEffect(() => {
    const handleTournamentsUpdate = () => {
      const list = getStoredTournaments();
      setTournaments(list);
      if (!list.some((t) => t.id === selectedTourneyId) && list.length > 0) {
        setSelectedTourneyId(list[0].id);
      }
    };
    const handleMembersUpdate = () => {
      setMembers(getStoredMembers());
    };
    const handleGroupsUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.tournamentId === selectedTourneyId && customEvent.detail?.pools) {
        setPools(customEvent.detail.pools);
      } else {
        setPools(getStoredTournamentGroups(selectedTourneyId));
      }
    };

    window.addEventListener('lagilagipadel_tournaments_updated', handleTournamentsUpdate);
    window.addEventListener('lagilagipadel_members_updated', handleMembersUpdate);
    window.addEventListener('lagilagipadel_groups_updated', handleGroupsUpdate);

    return () => {
      window.removeEventListener('lagilagipadel_tournaments_updated', handleTournamentsUpdate);
      window.removeEventListener('lagilagipadel_members_updated', handleMembersUpdate);
      window.removeEventListener('lagilagipadel_groups_updated', handleGroupsUpdate);
    };
  }, [selectedTourneyId]);

  // Selected tournament details
  const activeTournament = tournaments.find((t) => t.id === selectedTourneyId) || tournaments[0];

  // Auto-generate team name when members are picked
  useEffect(() => {
    const m1 = members.find((m) => m.id === selectedMember1Id);
    const m2 = members.find((m) => m.id === selectedMember2Id);

    if (m1 && m2) {
      const name1 = m1.nickname || m1.name.split(' ')[0];
      const name2 = m2.nickname || m2.name.split(' ')[0];
      setCustomTeamName(`${name1} & ${name2}`);
    } else if (m1) {
      setCustomTeamName(m1.nickname || m1.name);
    }
  }, [selectedMember1Id, selectedMember2Id, members]);

  // Calculate total teams assigned across all pools
  const totalAssignedTeams = pools.reduce((acc, p) => acc + p.teams.length, 0);

  // List of member IDs already assigned in this tournament
  const assignedMemberIds = new Set<string>();
  pools.forEach((p) => {
    p.teams.forEach((t) => {
      if (t.member1Id) assignedMemberIds.add(t.member1Id);
      if (t.member2Id) assignedMemberIds.add(t.member2Id);
    });
  });

  // Filter members for selection
  const filteredMembers = members.filter((m) => {
    if (!memberSearchTerm) return true;
    const term = memberSearchTerm.toLowerCase();
    return (
      m.name.toLowerCase().includes(term) ||
      (m.nickname && m.nickname.toLowerCase().includes(term)) ||
      m.club.toLowerCase().includes(term) ||
      m.id.toLowerCase().includes(term)
    );
  });

  // Action: Add / Assign Member to Pool (Direct to SQLite REST API)
  const handleAssignMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember1Id) {
      showAlert('error', 'Silakan pilih Member 1 terlebih dahulu.');
      return;
    }
    if (selectedMember1Id === selectedMember2Id) {
      showAlert('error', 'Member 1 dan Member 2 tidak boleh orang yang sama.');
      return;
    }
    if (!targetPool) {
      showAlert('error', 'Silakan pilih Pool tujuan.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedPools = await apiAssignMemberToPool({
        tournamentId: selectedTourneyId,
        targetPool,
        member1Id: selectedMember1Id,
        member2Id: selectedMember2Id || undefined,
        customTeamName: customTeamName.trim() || undefined,
        seed: Number(teamSeed) > 0 ? Number(teamSeed) : undefined
      });

      setPools(updatedPools);
      showAlert('success', `Tim "${customTeamName}" berhasil ditempatkan ke ${targetPool}!`);

      // Reset form selection
      setSelectedMember1Id('');
      setSelectedMember2Id('');
      setCustomTeamName('');
      setTeamSeed('0');

      if (onAllocationChanged) onAllocationChanged();
    } catch (err: any) {
      showAlert('error', err.message || 'Gagal menempatkan member ke pool.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Remove Team from Pool
  const handleRemoveTeam = async (teamId: string, teamName: string) => {
    if (!window.confirm(`Hapus tim "${teamName}" dari pool ini?`)) return;

    try {
      const updatedPools = await apiRemoveTeamFromPool(selectedTourneyId, teamId);
      setPools(updatedPools);
      showAlert('success', `Tim "${teamName}" dikeluarkan dari pool.`);
      if (onAllocationChanged) onAllocationChanged();
    } catch (err: any) {
      showAlert('error', err.message || 'Gagal menghapus tim.');
    }
  };

  // Action: Move Team to another Pool
  const handleMoveTeam = async (teamId: string, destPool: string) => {
    try {
      const updatedPools = await apiMoveTeamToPool(selectedTourneyId, teamId, destPool);
      setPools(updatedPools);
      showAlert('success', `Tim berhasil dipindahkan ke ${destPool}!`);
      if (onAllocationChanged) onAllocationChanged();
    } catch (err: any) {
      showAlert('error', err.message || 'Gagal memindahkan tim.');
    }
  };

  // Action: Add New Custom Pool
  const handleAddNewPool = () => {
    const trimmed = newPoolName.trim();
    if (!trimmed) return;
    if (pools.some((p) => p.poolName.toLowerCase() === trimmed.toLowerCase())) {
      showAlert('error', `Pool "${trimmed}" sudah ada.`);
      return;
    }

    const updatedPools: PoolGroupData[] = [...pools, { poolName: trimmed, teams: [] }];
    setPools(updatedPools);
    apiSaveGroups(selectedTourneyId, updatedPools);
    setTargetPool(trimmed);
    setNewPoolName('');
    setShowAddPoolInput(false);
    showAlert('success', `Pool "${trimmed}" berhasil ditambahkan.`);
    if (onAllocationChanged) onAllocationChanged();
  };

  // Action: Delete Pool
  const handleDeletePool = (poolNameToDelete: string) => {
    const targetPoolObj = pools.find((p) => p.poolName === poolNameToDelete);
    if (!targetPoolObj) return;

    if (targetPoolObj.teams.length > 0) {
      if (!window.confirm(`${poolNameToDelete} memiliki ${targetPoolObj.teams.length} tim. Yakin ingin menghapus pool beserta tim di dalamnya?`)) {
        return;
      }
    }

    const updatedPools = pools.filter((p) => p.poolName !== poolNameToDelete);
    setPools(updatedPools);
    apiSaveGroups(selectedTourneyId, updatedPools);
    if (targetPool === poolNameToDelete && updatedPools.length > 0) {
      setTargetPool(updatedPools[0].poolName);
    }
    showAlert('success', `Pool "${poolNameToDelete}" berhasil dihapus.`);
    if (onAllocationChanged) onAllocationChanged();
  };

  // Action: Smart Balance / Auto-Draw
  const handleSmartBalanceDraw = () => {
    const allTeams: GroupTeamItem[] = [];
    pools.forEach((p) => p.teams.forEach((t) => allTeams.push(t)));

    if (allTeams.length < 2) {
      showAlert('error', 'Minimal harus ada 2 tim yang ditempatkan untuk dapat diacak.');
      return;
    }

    const poolNames = pools.map((p) => p.poolName);
    const randomized = randomizeTeamsToPools(allTeams, poolNames);
    setPools(randomized);
    apiSaveGroups(selectedTourneyId, randomized);
    showAlert('success', 'Semua tim berhasil diacak dan didistribusikan ulang secara merata ke dalam pool!');
    if (onAllocationChanged) onAllocationChanged();
  };

  const m1Selected = members.find((m) => m.id === selectedMember1Id);
  const m2Selected = members.find((m) => m.id === selectedMember2Id);

  return (
    <div className="space-y-6">
      {/* Alert / Notification */}
      {alertInfo && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs font-semibold shadow-md animate-in slide-in-from-top-2 duration-200 border ${
            alertInfo.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {alertInfo.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            )}
            <span>{alertInfo.message}</span>
          </div>
          <button
            onClick={() => setAlertInfo(null)}
            className="text-xs font-bold underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Main Header & Tournament Switcher */}
      <div className="p-6 rounded-3xl bg-white border border-[#D8DFDE] shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#006A6A]/10 text-[#006A6A] font-mono font-bold text-[10px] uppercase">
                ADMINISTRATION MODULE
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-bold text-[10px] flex items-center gap-1">
                <Database className="w-3 h-3 text-emerald-600" />
                <span>SERVER SQLITE TERPUSAT</span>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#191C1C] font-display flex items-center gap-2">
              <Layers className="w-6 h-6 text-[#006A6A]" />
              <span>Alokasi & Penempatan Member ke Grup/Pool</span>
            </h2>
            <p className="text-xs text-[#6F7978]">
              Pilih turnamen, tentukan member dari database, bentuk tim ganda/tunggal, dan alokasikan langsung ke Pool A, B, C, D. Data langsung tersimpan di SQLite server dan tampil sama di semua perangkat.
            </p>
          </div>

          {/* Tournament Selector */}
          <div className="shrink-0 space-y-1 bg-[#F6FAF9] p-3 rounded-2xl border border-[#D8DFDE]">
            <label className="block text-[10px] font-mono font-bold text-[#3D5A57] uppercase">
              Turnamen Aktif:
            </label>
            <select
              value={selectedTourneyId}
              onChange={(e) => setSelectedTourneyId(e.target.value)}
              className="w-full sm:w-64 px-3 py-2 rounded-xl bg-white border border-[#D8DFDE] text-xs font-bold text-[#191C1C] focus:outline-none focus:border-[#006A6A] cursor-pointer"
            >
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} [{t.status}]
                </option>
              ))}
            </select>
            <div className="flex items-center justify-between text-[10px] text-[#6F7978] pt-1">
              <span>{activeTournament?.location || 'Solo'}</span>
              <span className="font-mono font-bold text-[#006A6A]">{totalAssignedTeams} Tim Terdaftar</span>
            </div>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#D8DFDE]">
          <div className="p-3 rounded-xl bg-[#F6FAF9] border border-[#D8DFDE]">
            <div className="text-[10px] font-mono text-[#6F7978] uppercase">Total Pool Aktif</div>
            <div className="text-lg font-black text-[#006A6A] font-display">{pools.length} Pool</div>
          </div>
          <div className="p-3 rounded-xl bg-[#F6FAF9] border border-[#D8DFDE]">
            <div className="text-[10px] font-mono text-[#6F7978] uppercase">Tim di Pool</div>
            <div className="text-lg font-black text-[#191C1C] font-display">{totalAssignedTeams} Pasangan</div>
          </div>
          <div className="p-3 rounded-xl bg-[#F6FAF9] border border-[#D8DFDE]">
            <div className="text-[10px] font-mono text-[#6F7978] uppercase">Member di Database</div>
            <div className="text-lg font-black text-[#3D5A57] font-display">{members.length} Pemain</div>
          </div>
          <div className="p-3 rounded-xl bg-[#F6FAF9] border border-[#D8DFDE]">
            <div className="text-[10px] font-mono text-[#6F7978] uppercase">Sinkronisasi Realtime</div>
            <div className="text-xs font-bold text-emerald-700 flex items-center gap-1 mt-1 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Multi-Device Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two Columns Grid: Form Placement (Left) & Pools Visualizer (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (5 cols): FORM PENEMPATAN MEMBER */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-white border border-[#D8DFDE] shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#D8DFDE]">
            <div>
              <h3 className="text-sm font-black text-[#191C1C] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#006A6A]" />
                <span>Form Penempatan Member ke Pool</span>
              </h3>
              <p className="text-[11px] text-[#6F7978]">
                Bentuk tim dan tempatkan langsung ke grup turnamen
              </p>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#006A6A]/10 text-[#006A6A]">
              REST API
            </span>
          </div>

          <form onSubmit={handleAssignMember} className="space-y-4">
            {/* Search Filter for Members */}
            <div className="space-y-1">
              <label className="block text-[11px] font-mono font-bold text-[#3D5A57] uppercase">
                Cari Member (Nama / Klub / ID):
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-[#6F7978] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Ketik nama pemain untuk menyaring..."
                  value={memberSearchTerm}
                  onChange={(e) => setMemberSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#F6FAF9] border border-[#D8DFDE] text-[#191C1C] focus:outline-none focus:border-[#006A6A]"
                />
              </div>
            </div>

            {/* MEMBER 1 SELECTOR */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-mono font-bold text-[#3D5A57] uppercase flex items-center justify-between">
                <span>Member 1 (Wajib):</span>
                {m1Selected && (
                  <span className="text-[#006A6A] font-bold">NTRP: {m1Selected.rating}</span>
                )}
              </label>
              <select
                value={selectedMember1Id}
                onChange={(e) => setSelectedMember1Id(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F6FAF9] border border-[#D8DFDE] text-xs font-bold text-[#191C1C] focus:outline-none focus:border-[#006A6A] cursor-pointer"
                required
              >
                <option value="">-- Pilih Member 1 dari Database --</option>
                {filteredMembers.map((m) => {
                  const isAssigned = assignedMemberIds.has(m.id);
                  return (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.nickname ? `(${m.nickname})` : ''} · NTRP {m.rating} [{m.club}]
                      {isAssigned ? ' ★ Sudah Ada di Pool' : ''}
                    </option>
                  );
                })}
              </select>

              {/* Member 1 Preview Card */}
              {m1Selected && (
                <div className="p-2.5 rounded-xl bg-[#EEF4F3] border border-[#D8DFDE] flex items-center gap-2.5">
                  <img
                    src={m1Selected.photoUrl || lookupPlayerPhoto(m1Selected.name)}
                    alt={m1Selected.name}
                    className="w-10 h-10 rounded-xl object-cover border border-[#D8DFDE]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-[#191C1C] truncate">{m1Selected.name}</div>
                    <div className="text-[10px] text-[#6F7978] truncate">
                      {m1Selected.club} · {m1Selected.city}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-[#006A6A] text-white text-[10px] font-mono font-bold">
                    P1
                  </span>
                </div>
              )}
            </div>

            {/* MEMBER 2 SELECTOR (GANDA) */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-mono font-bold text-[#3D5A57] uppercase flex items-center justify-between">
                <span>Member 2 / Pasangan Ganda (Opsional):</span>
                {m2Selected && (
                  <span className="text-[#006A6A] font-bold">NTRP: {m2Selected.rating}</span>
                )}
              </label>
              <select
                value={selectedMember2Id}
                onChange={(e) => setSelectedMember2Id(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F6FAF9] border border-[#D8DFDE] text-xs font-bold text-[#191C1C] focus:outline-none focus:border-[#006A6A] cursor-pointer"
              >
                <option value="">-- Pilih Member 2 (Atau biarkan kosong untuk Single) --</option>
                {filteredMembers
                  .filter((m) => m.id !== selectedMember1Id)
                  .map((m) => {
                    const isAssigned = assignedMemberIds.has(m.id);
                    return (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.nickname ? `(${m.nickname})` : ''} · NTRP {m.rating} [{m.club}]
                        {isAssigned ? ' ★ Sudah Ada di Pool' : ''}
                      </option>
                    );
                  })}
              </select>

              {/* Member 2 Preview Card */}
              {m2Selected && (
                <div className="p-2.5 rounded-xl bg-[#EEF4F3] border border-[#D8DFDE] flex items-center gap-2.5">
                  <img
                    src={m2Selected.photoUrl || lookupPlayerPhoto(m2Selected.name)}
                    alt={m2Selected.name}
                    className="w-10 h-10 rounded-xl object-cover border border-[#D8DFDE]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-[#191C1C] truncate">{m2Selected.name}</div>
                    <div className="text-[10px] text-[#6F7978] truncate">
                      {m2Selected.club} · {m2Selected.city}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-[#3D5A57] text-white text-[10px] font-mono font-bold">
                    P2
                  </span>
                </div>
              )}
            </div>

            {/* CUSTOM TEAM NAME */}
            <div className="space-y-1">
              <label className="block text-[11px] font-mono font-bold text-[#3D5A57] uppercase">
                Nama Tim / Pasangan:
              </label>
              <input
                type="text"
                value={customTeamName}
                onChange={(e) => setCustomTeamName(e.target.value)}
                placeholder="Contoh: Budi & Kevin"
                className="w-full px-3 py-2 rounded-xl bg-[#F6FAF9] border border-[#D8DFDE] text-xs font-bold text-[#191C1C] focus:outline-none focus:border-[#006A6A]"
                required
              />
            </div>

            {/* POOL TUJUAN & SEED */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-mono font-bold text-[#3D5A57] uppercase">
                  Pool Tujuan:
                </label>
                <select
                  value={targetPool}
                  onChange={(e) => setTargetPool(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F6FAF9] border border-[#D8DFDE] text-xs font-bold text-[#191C1C] focus:outline-none focus:border-[#006A6A] cursor-pointer"
                >
                  {pools.map((p) => (
                    <option key={p.poolName} value={p.poolName}>
                      {p.poolName} ({p.teams.length} Tim)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-mono font-bold text-[#3D5A57] uppercase">
                  Status Unggulan (Seed):
                </label>
                <select
                  value={teamSeed}
                  onChange={(e) => setTeamSeed(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F6FAF9] border border-[#D8DFDE] text-xs font-bold text-[#191C1C] focus:outline-none focus:border-[#006A6A] cursor-pointer"
                >
                  <option value="0">Non-Unggulan</option>
                  <option value="1">Unggulan 1 (Seed #1)</option>
                  <option value="2">Unggulan 2 (Seed #2)</option>
                  <option value="3">Unggulan 3 (Seed #3)</option>
                  <option value="4">Unggulan 4 (Seed #4)</option>
                </select>
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={isSubmitting || !selectedMember1Id}
              className="w-full py-3 rounded-xl bg-[#006A6A] hover:bg-[#007A7C] text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan ke SQLite Server...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Tempatkan Tim ke {targetPool} ✓</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Pool Creator */}
          <div className="pt-4 border-t border-[#D8DFDE] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-[#3D5A57] uppercase">
                Kelola Pool Turnamen
              </span>
              <button
                type="button"
                onClick={() => setShowAddPoolInput(!showAddPoolInput)}
                className="text-xs font-semibold text-[#006A6A] hover:underline cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Pool Baru</span>
              </button>
            </div>

            {showAddPoolInput && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-[#F6FAF9] border border-[#D8DFDE] animate-in fade-in duration-150">
                <input
                  type="text"
                  placeholder="Nama Pool baru (e.g. Pool E)"
                  value={newPoolName}
                  onChange={(e) => setNewPoolName(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-white rounded-lg border border-[#D8DFDE] text-[#191C1C] focus:outline-none focus:border-[#006A6A]"
                />
                <button
                  type="button"
                  onClick={handleAddNewPool}
                  className="px-3 py-1.5 rounded-lg bg-[#006A6A] text-white text-xs font-bold hover:bg-[#007A7C] cursor-pointer"
                >
                  Tambah
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (7 cols): POOLS VISUALIZER & QUICK MOVERS */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-[#D8DFDE] shadow-xs">
            <div>
              <h3 className="text-sm font-black text-[#191C1C] flex items-center gap-2">
                <span>Daftar Susunan Pool Turnamen</span>
                <span className="px-2 py-0.5 rounded-md bg-[#006A6A]/10 text-[#006A6A] font-mono text-[10px] font-bold">
                  {pools.length} Pool Aktif
                </span>
              </h3>
              <p className="text-[11px] text-[#6F7978]">
                Tinjau penempatan tim, pindah pool instan, atau acak ulang secara adil
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSmartBalanceDraw}
                className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                title="Acak semua tim yang ada ke seluruh pool secara merata"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Acak Semua Tim</span>
              </button>
            </div>
          </div>

          {/* Grid of Pools */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pools.map((poolGroup) => (
              <div
                key={poolGroup.poolName}
                className="p-5 rounded-2xl bg-white border border-[#D8DFDE] shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#D8DFDE]">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#006A6A]" />
                    <h4 className="text-sm font-black text-[#191C1C] font-display">
                      {poolGroup.poolName}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#006A6A] bg-[#EEF4F3] px-2 py-0.5 rounded-lg border border-[#D8DFDE]">
                      {poolGroup.teams.length} Tim
                    </span>
                    {pools.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleDeletePool(poolGroup.poolName)}
                        className="text-[#6F7978] hover:text-rose-600 p-1 cursor-pointer"
                        title={`Hapus ${poolGroup.poolName}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {poolGroup.teams.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#6F7978] italic bg-[#F6FAF9] rounded-xl border border-dashed border-[#D8DFDE]">
                      Belum ada tim di {poolGroup.poolName}. Gunakan form di sebelah kiri untuk menempatkan pemain.
                    </div>
                  ) : (
                    poolGroup.teams.map((team, idx) => {
                      const p1Photo = team.p1Photo || lookupPlayerPhoto(team.p1);
                      const p2Photo = team.p2Photo || lookupPlayerPhoto(team.p2);

                      return (
                        <div
                          key={team.id}
                          className="p-3 rounded-xl bg-[#F6FAF9] border border-[#D8DFDE] hover:bg-white transition-all shadow-xs space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-5 h-5 rounded-md bg-[#EEF4F3] text-[#006A6A] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                                #{idx + 1}
                              </span>

                              {/* Stacked Photos */}
                              <div className="flex -space-x-2 shrink-0">
                                <img
                                  src={p1Photo}
                                  alt={team.p1}
                                  className="w-8 h-8 rounded-lg object-cover border-2 border-white"
                                />
                                {team.p2 && team.p2 !== 'Partner TBD' && (
                                  <img
                                    src={p2Photo}
                                    alt={team.p2}
                                    className="w-8 h-8 rounded-lg object-cover border-2 border-white"
                                  />
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="font-bold text-xs text-[#191C1C] truncate flex items-center gap-1.5">
                                  <span>{team.name}</span>
                                  {team.seed && team.seed > 0 && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-amber-100 text-amber-800 border border-amber-300">
                                      SEED #{team.seed}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-[#6F7978] truncate">
                                  {team.p1} {team.p2 ? `& ${team.p2}` : ''} · <span className="font-mono text-[#006A6A] font-bold">NTRP {team.rating || '3.0'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Delete Team Button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveTeam(team.id, team.name)}
                              className="text-[#6F7978] hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer shrink-0 transition-colors"
                              title="Keluarkan tim dari pool"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Quick Move Selector */}
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#D8DFDE]/60 text-[10px]">
                            <span className="text-[#6F7978] font-mono">Pindah Pool:</span>
                            <select
                              value={poolGroup.poolName}
                              onChange={(e) => handleMoveTeam(team.id, e.target.value)}
                              className="px-2 py-0.5 rounded-md bg-white border border-[#D8DFDE] text-[#3D5A57] font-semibold text-[10px] cursor-pointer"
                            >
                              {pools.map((p) => (
                                <option key={p.poolName} value={p.poolName}>
                                  Pindah ke {p.poolName}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
