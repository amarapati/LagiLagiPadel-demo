import React from 'react';
import { Trophy, Zap, Flame, Crown, Check, Clock, Radio } from 'lucide-react';
import { KnockoutMatch } from '../data/padelProTournamentsData';
import { lookupPlayerPhoto } from '../data/clubMembersStorage';

interface KnockoutBracketVisualizerProps {
  roundOf16?: KnockoutMatch[];
  quarters?: KnockoutMatch[];
  semis?: KnockoutMatch[];
  grandFinal?: KnockoutMatch;
  bronzeMatch?: KnockoutMatch;
  tournamentName?: string;
  onEditMatch?: (match: KnockoutMatch, roundType: string) => void;
  isAdminMode?: boolean;
}

export const KnockoutBracketVisualizer: React.FC<KnockoutBracketVisualizerProps> = ({
  roundOf16,
  quarters = [],
  semis = [],
  grandFinal,
  bronzeMatch,
  onEditMatch,
  isAdminMode = false
}) => {
  // Determine actual format based on provided data
  const hasRoundOf16 = Boolean(roundOf16 && roundOf16.length > 0);
  const hasQuarters = Boolean(quarters && quarters.length > 0);
  const hasSemis = Boolean(semis && semis.length > 0);
  const isDirectFinal = !hasRoundOf16 && !hasQuarters && !hasSemis;

  // Clean fallback for Grand Final if completely missing
  const effectiveGrandFinal: KnockoutMatch = grandFinal || {
    id: 'gf-default',
    roundTitle: 'Grand Final (Gold Match)',
    court: 'Court 1',
    time: '17:00',
    team1: { name: 'Juara Pool A', players: 'TBD', score: '-', isWinner: false },
    team2: { name: 'Juara Pool B', players: 'TBD', score: '-', isWinner: false },
    status: 'Dijadwalkan'
  };

  // Safe Quarters (only populated if tournament actually has Quarterfinals)
  const safeQuarters: KnockoutMatch[] = hasQuarters
    ? Array.from({ length: Math.max(quarters?.length || 0, 4) }, (_, i) => {
        return (
          quarters[i] || {
            id: `qf-fallback-${i + 1}`,
            roundTitle: `Perempat Final ${i + 1}`,
            court: `Court ${(i % 2) + 1}`,
            time: '12:00',
            team1: { name: `Juara Pool ${String.fromCharCode(65 + i)}`, players: 'TBD', score: '-', isWinner: false },
            team2: { name: `Runner-up Pool ${String.fromCharCode(65 + ((i + 1) % 4))}`, players: 'TBD', score: '-', isWinner: false },
            status: 'Dijadwalkan'
          }
        );
      })
    : [];

  // Safe Semis (only populated if tournament actually has Semifinals)
  const safeSemis: KnockoutMatch[] = hasSemis
    ? Array.from({ length: Math.max(semis?.length || 0, 2) }, (_, i) => {
        return (
          semis[i] || {
            id: `sf-fallback-${i + 1}`,
            roundTitle: `Semifinal ${i + 1}`,
            court: `Court ${i + 1}`,
            time: '14:00',
            team1: { name: hasQuarters ? `Pemenang QF ${i * 2 + 1}` : `Juara Pool ${String.fromCharCode(65 + i)}`, players: 'TBD', score: '-', isWinner: false },
            team2: { name: hasQuarters ? `Pemenang QF ${i * 2 + 2}` : `Runner-up Pool ${String.fromCharCode(66 - i)}`, players: 'TBD', score: '-', isWinner: false },
            status: 'Dijadwalkan'
          }
        );
      })
    : [];

  // Safe Round of 16 (8 items if enabled)
  const safeR16: KnockoutMatch[] = hasRoundOf16 && roundOf16 ? roundOf16.slice(0, 8) : [];

  // Render Status Badge
  const renderStatusBadge = (status: string) => {
    if (status === 'Live') {
      return (
        <span className="bg-red-50 border border-red-200 text-red-700 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
          <Radio className="w-2.5 h-2.5 animate-pulse text-red-600" />
          <span>LIVE</span>
        </span>
      );
    }
    if (status === 'Dijadwalkan') {
      return (
        <span className="bg-neutral-50 border border-neutral-200 text-neutral-600 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
          <Clock className="w-2.5 h-2.5 text-neutral-500" />
          <span>SCHEDULED</span>
        </span>
      );
    }
    return (
      <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
        <Check className="w-2.5 h-2.5 text-emerald-600" />
        <span>FINISHED</span>
      </span>
    );
  };

  // Helper renderer for a single match card
  const renderMatchCard = (
    match: KnockoutMatch,
    roundType: string,
    customWidthClass = 'w-[230px]'
  ) => {
    const isLive = match.status === 'Live';
    return (
      <div
        onClick={() => isAdminMode && onEditMatch && onEditMatch(match, roundType)}
        className={`${customWidthClass} h-[96px] bg-white rounded-2xl border p-2.5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group ${
          isLive
            ? 'border-red-300 ring-2 ring-red-400/50 bg-gradient-to-r from-red-50/40 to-white'
            : 'border-[#D8DFDE] hover:border-[#006A6A]'
        } ${isAdminMode ? 'cursor-pointer ring-2 ring-transparent hover:ring-[#006A6A]/40' : ''}`}
      >
        {/* Top Header: Court Tag & Status */}
        <div className="flex items-center justify-between">
          <span className="bg-[#006A6A] text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider shadow-xs">
            {match.court || 'Court 1'}
          </span>
          <div className="flex items-center gap-1.5">
            {renderStatusBadge(match.status)}
            {isAdminMode && (
              <span className="text-[9px] font-mono text-[#006A6A] bg-[#E6F4F2] px-1.5 py-0.5 rounded font-bold">
                Edit
              </span>
            )}
          </div>
        </div>

        {/* Teams List */}
        <div className="space-y-1">
          {/* Team 1 */}
          <div
            className={`flex items-center justify-between px-2 py-0.5 rounded-lg text-xs transition-colors ${
              match.team1.isWinner
                ? 'bg-[#E6F4F2] border border-[#006A6A]/40 text-[#004F4F] font-bold'
                : 'text-[#475569] font-medium'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0 pr-1">
              {match.team1.isWinner ? (
                <Trophy className="w-3 h-3 text-amber-600 shrink-0" />
              ) : null}
              <img
                src={lookupPlayerPhoto(match.team1.name || match.team1.players)}
                alt={match.team1.name}
                className="w-4 h-4 rounded-full object-cover border border-[#CBD5D4] shrink-0"
              />
              <span className="truncate text-[11px] leading-tight">{match.team1.name}</span>
            </div>
            <span
              className={`font-mono text-xs shrink-0 ${
                match.team1.isWinner ? 'font-black text-[#006A6A]' : 'font-bold'
              }`}
            >
              {match.team1.score}
            </span>
          </div>

          {/* Team 2 */}
          <div
            className={`flex items-center justify-between px-2 py-0.5 rounded-lg text-xs transition-colors ${
              match.team2.isWinner
                ? 'bg-[#E6F4F2] border border-[#006A6A]/40 text-[#004F4F] font-bold'
                : 'text-[#475569] font-medium'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0 pr-1">
              {match.team2.isWinner ? (
                <Trophy className="w-3 h-3 text-amber-600 shrink-0" />
              ) : null}
              <img
                src={lookupPlayerPhoto(match.team2.name || match.team2.players)}
                alt={match.team2.name}
                className="w-4 h-4 rounded-full object-cover border border-[#CBD5D4] shrink-0"
              />
              <span className="truncate text-[11px] leading-tight">{match.team2.name}</span>
            </div>
            <span
              className={`font-mono text-xs shrink-0 ${
                match.team2.isWinner ? 'font-black text-[#006A6A]' : 'font-bold'
              }`}
            >
              {match.team2.score}
            </span>
          </div>
        </div>

        {/* Bottom Time & Round Info */}
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-[#6F7978] font-mono truncate max-w-[130px]">
            {match.roundTitle}
          </span>
          <span className="font-mono font-bold text-[#006A6A] leading-none">
            {match.time || '18:00'}
          </span>
        </div>
      </div>
    );
  };

  const connectorColor = '#006A6A';

  // Render 4-Column Layout (With Round of 16)
  if (hasRoundOf16) {
    return (
      <div className="w-full space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#6F7978] px-1 gap-2">
          <span className="font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#006A6A]" />
            <span>Format Sistem Gugur 16 Besar (Official Round of 16 Tree)</span>
          </span>
          <span className="bg-[#EEF4F3] border border-[#D8DFDE] text-[#006A6A] font-semibold text-[11px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 self-start sm:self-auto">
            <span>⇄ Geser horizontal untuk melihat seluruh babak</span>
          </span>
        </div>

        <div className="overflow-x-auto pb-6 scrollbar-thin">
          <div className="min-w-[1260px] p-6 rounded-3xl bg-[#F6FAF9] border border-[#D8DFDE] shadow-xs space-y-6">
            {/* Header Badges */}
            <div className="grid grid-cols-[230px_40px_230px_40px_230px_40px_260px] items-center">
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#E6F4F2] border border-[#006A6A]/30 text-[#006A6A] text-xs font-extrabold uppercase shadow-xs">
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>ROUND OF 16</span>
                </div>
              </div>
              <div />
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#E6F4F2] border border-[#006A6A]/30 text-[#006A6A] text-xs font-extrabold uppercase shadow-xs">
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>QUARTER FINALS</span>
                </div>
              </div>
              <div />
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F3DAFF]/70 border border-[#6E4D8B]/30 text-[#6E4D8B] text-xs font-extrabold uppercase shadow-xs">
                  <Flame className="w-3.5 h-3.5 fill-current text-[#6E4D8B]" />
                  <span>SEMI FINALS</span>
                </div>
              </div>
              <div />
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#FEF08A] border border-amber-300 text-[#854D0E] text-xs font-black uppercase shadow-xs">
                  <Crown className="w-3.5 h-3.5 text-amber-700" />
                  <span>FINAL & JUARA 3</span>
                  <Trophy className="w-3.5 h-3.5 text-amber-700" />
                </div>
              </div>
            </div>

            {/* Tree Structure Layout */}
            <div className="grid grid-cols-[230px_40px_230px_40px_230px_40px_260px] items-stretch">
              {/* Column 1: Round of 16 */}
              <div className="flex flex-col gap-6">
                {[0, 2, 4, 6].map((idx) => (
                  <div key={idx} className="flex flex-col gap-3">
                    {renderMatchCard(safeR16[idx], 'roundOf16')}
                    {renderMatchCard(safeR16[idx + 1], 'roundOf16')}
                  </div>
                ))}
              </div>

              {/* Connectors: R16 -> QF */}
              <div className="flex flex-col gap-6">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-[204px] flex items-center justify-center">
                    <svg className="w-full h-full" viewBox="0 0 40 204" fill="none">
                      <path d="M 0,48 H 22 V 102 H 40" stroke={connectorColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M 0,156 H 22 V 102" stroke={connectorColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                ))}
              </div>

              {/* Column 2: Quarterfinals */}
              <div className="flex flex-col gap-6">
                {safeQuarters.map((qf, i) => (
                  <div key={i} className="h-[204px] flex items-center">
                    {renderMatchCard(qf, 'quarters')}
                  </div>
                ))}
              </div>

              {/* Connectors: QF -> Semis */}
              <div className="flex flex-col gap-6">
                {[0, 1].map((i) => (
                  <div key={i} className="h-[432px] flex items-center justify-center">
                    <svg className="w-full h-full" viewBox="0 0 40 432" fill="none">
                      <path d="M 0,102 H 22 V 216 H 40" stroke={connectorColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M 0,330 H 22 V 216" stroke={connectorColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                ))}
              </div>

              {/* Column 3: Semifinals */}
              <div className="flex flex-col gap-6">
                {safeSemis.map((sf, i) => (
                  <div key={i} className="h-[432px] flex items-center">
                    {renderMatchCard(sf, 'semis')}
                  </div>
                ))}
              </div>

              {/* Connectors: Semis -> Finals */}
              <div className="h-[888px] flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 40 888" fill="none">
                  <path d="M 0,216 H 22 V 420 H 40" stroke={connectorColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M 0,672 H 22 V 420" stroke={connectorColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M 22,545 H 40" stroke={connectorColor} strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>

              {/* Column 4: Grand Final & Bronze */}
              <div className="h-[888px] flex flex-col justify-center gap-6">
                {renderFinalCard(effectiveGrandFinal, bronzeMatch)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render 1-Column Layout: DIRECT GRAND FINAL (Direct Pool Champions Playoff - No Quarters, No Semis)
  if (isDirectFinal) {
    return (
      <div className="w-full space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#6F7978] px-1 gap-2">
          <span className="font-medium flex items-center gap-1.5 text-[#006A6A]">
            <Crown className="w-4 h-4 text-amber-500 fill-amber-400" />
            <span className="font-extrabold text-[#191C1C]">Format Sistem Gugur: Langsung Grand Final</span>
          </span>
          <span className="bg-[#FEF9C3] border border-amber-300 text-amber-900 font-bold text-[11px] px-3 py-1 rounded-full inline-flex items-center gap-1.5 self-start sm:self-auto shadow-2xs">
            <Trophy className="w-3.5 h-3.5 text-amber-600" />
            <span>Pemenang Pool Melaju Langsung ke Laga Final</span>
          </span>
        </div>

        <div className="p-6 sm:p-8 rounded-3xl bg-[#F6FAF9] border border-[#D8DFDE] shadow-xs space-y-6">
          {/* Informative Header Banner */}
          <div className="p-4 rounded-2xl bg-white border border-[#D8DFDE] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 text-amber-700 shadow-2xs">
                <Crown className="w-5 h-5 text-amber-600" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-black text-[#191C1C] uppercase tracking-wider flex items-center gap-2">
                  <span>Pertandingan Puncak Langsung Juara Pool</span>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                    Tanpa QF & Semifinal
                  </span>
                </h4>
                <p className="text-[11px] text-[#6F7978] leading-relaxed">
                  Turnamen ini dikonfigurasi langsung mempertemukan juara klasemen pool di babak Grand Final untuk memperebutkan Gelar Juara 1 (Gold Champion).
                </p>
              </div>
            </div>
            {isAdminMode && (
              <span className="text-[11px] font-bold text-[#006A6A] bg-[#EEF4F3] border border-[#006A6A]/20 px-3 py-1.5 rounded-xl self-start md:self-auto shrink-0 font-mono">
                ✏️ Klik kartu untuk edit skor & pasangan
              </span>
            )}
          </div>

          {/* Championship Direct Matchup Stage */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="mb-6 inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#FEF08A] border border-amber-300 text-[#854D0E] text-xs font-black uppercase tracking-wider shadow-xs">
              <Crown className="w-4 h-4 text-amber-700" />
              <span>PERTANDINGAN PUNCAK GRAND FINAL</span>
              <Trophy className="w-4 h-4 text-amber-700" />
            </div>

            {/* Direct Match Cards Display */}
            <div className="w-full max-w-xl flex flex-col items-center gap-4">
              <div className="w-full flex items-center justify-between px-2 sm:px-6 text-xs font-bold text-[#006A6A]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#006A6A]" />
                  <span>Juara Pool A</span>
                </div>
                <span className="text-[10px] font-mono text-[#6F7978] uppercase tracking-wider bg-white px-2.5 py-0.5 rounded-md border border-[#D8DFDE]">
                  Laga Final
                </span>
                <div className="flex items-center gap-1.5">
                  <span>Juara Pool B</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#006A6A]" />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-6 w-full">
                {renderFinalCard(effectiveGrandFinal, bronzeMatch, 'w-[280px] sm:w-[320px]')}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render 2-Column Layout: SEMIFINALS -> GRAND FINAL (4-Team Playoff - Tanpa Perempat Final)
  if (!hasRoundOf16 && !hasQuarters && hasSemis) {
    return (
      <div className="w-full space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#6F7978] px-1 gap-2">
          <span className="font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#006A6A]" />
            <span>Format Sistem Gugur 4 Besar Playoff (Semifinal ke Grand Final)</span>
          </span>
          <span className="bg-[#EEF4F3] border border-[#D8DFDE] text-[#006A6A] font-semibold text-[11px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 self-start sm:self-auto">
            <span>⇄ Geser horizontal untuk melihat seluruh babak</span>
          </span>
        </div>

        <div className="overflow-x-auto pb-6 scrollbar-thin">
          <div className="min-w-[640px] max-w-3xl mx-auto p-6 rounded-3xl bg-[#F6FAF9] border border-[#D8DFDE] shadow-xs space-y-6">
            {/* Header Badges */}
            <div className="grid grid-cols-[240px_40px_270px] items-center">
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F3DAFF]/70 border border-[#6E4D8B]/30 text-[#6E4D8B] text-xs font-extrabold uppercase shadow-xs">
                  <Flame className="w-3.5 h-3.5 fill-current text-[#6E4D8B]" />
                  <span>SEMI FINALS (SEMIFINAL)</span>
                </div>
              </div>
              <div />
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#FEF08A] border border-amber-300 text-[#854D0E] text-xs font-black uppercase shadow-xs">
                  <Crown className="w-3.5 h-3.5 text-amber-700" />
                  <span>GRAND FINAL & JUARA 3</span>
                  <Trophy className="w-3.5 h-3.5 text-amber-700" />
                </div>
              </div>
            </div>

            {/* Tree Structure Layout: 2 Columns */}
            <div className="grid grid-cols-[240px_40px_270px] items-stretch">
              {/* Column 1: Semifinals (2 Matches) */}
              <div className="flex flex-col justify-around gap-6 py-4">
                <div className="flex flex-col gap-2">
                  <div className="text-[10px] font-mono font-bold text-[#6E4D8B] px-1">SEMIFINAL 1</div>
                  {renderMatchCard(safeSemis[0], 'semis', 'w-[240px]')}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="text-[10px] font-mono font-bold text-[#6E4D8B] px-1">SEMIFINAL 2</div>
                  {renderMatchCard(safeSemis[1], 'semis', 'w-[240px]')}
                </div>
              </div>

              {/* Connectors: Semis -> Finals */}
              <div className="h-full min-h-[300px] flex items-center justify-center">
                <svg className="w-full h-full max-h-[340px]" viewBox="0 0 40 300" fill="none">
                  <path d="M 0,75 H 22 V 150 H 40" stroke={connectorColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M 0,225 H 22 V 150" stroke={connectorColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  {bronzeMatch && (
                    <path d="M 22,205 H 40" stroke={connectorColor} strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
                  )}
                </svg>
              </div>

              {/* Column 2: Grand Final & Bronze */}
              <div className="flex flex-col justify-center gap-4 py-2">
                {renderFinalCard(effectiveGrandFinal, bronzeMatch)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render 3-Column Layout (Quarter Finals -> Semi Finals -> Grand Final) - STANDARD 4-POOL TOURNAMENT
  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#6F7978] px-1 gap-2">
        <span className="font-medium flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#006A6A]" />
          <span>Format Sistem Gugur 8 Besar Playoff (Quarterfinal ke Grand Final)</span>
        </span>
        <span className="bg-[#EEF4F3] border border-[#D8DFDE] text-[#006A6A] font-semibold text-[11px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 self-start sm:self-auto">
          <span>⇄ Geser horizontal untuk melihat seluruh babak</span>
        </span>
      </div>

      <div className="overflow-x-auto pb-6 scrollbar-thin">
        <div className="min-w-[960px] p-6 rounded-3xl bg-[#F6FAF9] border border-[#D8DFDE] shadow-xs space-y-6">
          {/* Header Badges */}
          <div className="grid grid-cols-[240px_40px_240px_40px_270px] items-center">
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#E6F4F2] border border-[#006A6A]/30 text-[#006A6A] text-xs font-extrabold uppercase shadow-xs">
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>QUARTER FINALS (PEREMPAT FINAL)</span>
              </div>
            </div>
            <div />
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F3DAFF]/70 border border-[#6E4D8B]/30 text-[#6E4D8B] text-xs font-extrabold uppercase shadow-xs">
                <Flame className="w-3.5 h-3.5 fill-current text-[#6E4D8B]" />
                <span>SEMI FINALS (SEMIFINAL)</span>
              </div>
            </div>
            <div />
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#FEF08A] border border-amber-300 text-[#854D0E] text-xs font-black uppercase shadow-xs">
                <Crown className="w-3.5 h-3.5 text-amber-700" />
                <span>GRAND FINAL & JUARA 3</span>
                <Trophy className="w-3.5 h-3.5 text-amber-700" />
              </div>
            </div>
          </div>

          {/* Tree Structure Layout */}
          <div className="grid grid-cols-[240px_40px_240px_40px_270px] items-stretch">
            {/* Column 1: Quarterfinals (4 Matches in 2 Pairs) */}
            <div className="flex flex-col gap-6">
              {/* QF Pair 1 */}
              <div className="flex flex-col gap-3">
                {renderMatchCard(safeQuarters[0], 'quarters', 'w-[240px]')}
                {renderMatchCard(safeQuarters[1], 'quarters', 'w-[240px]')}
              </div>
              {/* QF Pair 2 */}
              <div className="flex flex-col gap-3">
                {renderMatchCard(safeQuarters[2], 'quarters', 'w-[240px]')}
                {renderMatchCard(safeQuarters[3], 'quarters', 'w-[240px]')}
              </div>
            </div>

            {/* Connectors: QF -> Semis */}
            <div className="flex flex-col gap-6">
              {/* Pair 1 to SF1 */}
              <div className="h-[204px] flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 40 204" fill="none">
                  <path d="M 0,48 H 22 V 102 H 40" stroke={connectorColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M 0,156 H 22 V 102" stroke={connectorColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              {/* Pair 2 to SF2 */}
              <div className="h-[204px] flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 40 204" fill="none">
                  <path d="M 0,48 H 22 V 102 H 40" stroke={connectorColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M 0,156 H 22 V 102" stroke={connectorColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Column 2: Semifinals (2 Matches) */}
            <div className="flex flex-col gap-6">
              <div className="h-[204px] flex items-center">
                {renderMatchCard(safeSemis[0], 'semis', 'w-[240px]')}
              </div>
              <div className="h-[204px] flex items-center">
                {renderMatchCard(safeSemis[1], 'semis', 'w-[240px]')}
              </div>
            </div>

            {/* Connectors: Semis -> Finals */}
            <div className="h-[432px] flex items-center justify-center">
              <svg className="w-full h-full" viewBox="0 0 40 432" fill="none">
                <path d="M 0,102 H 22 V 216 H 40" stroke={connectorColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 0,330 H 22 V 216" stroke={connectorColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 22,290 H 40" stroke={connectorColor} strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>

            {/* Column 3: Grand Final & Perebutan Juara 3 */}
            <div className="h-[432px] flex flex-col justify-center gap-4">
              {renderFinalCard(effectiveGrandFinal, bronzeMatch)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Helper for final match cards
  function renderFinalCard(gf: KnockoutMatch, bm?: KnockoutMatch, customWidthClass = 'w-[260px]') {
    const isLive = gf.status === 'Live';
    return (
      <div className="space-y-4">
        {/* Grand Final Card */}
        <div
          onClick={() => isAdminMode && onEditMatch && onEditMatch(gf, 'grandFinal')}
          className={`${customWidthClass} ${isAdminMode ? 'cursor-pointer' : ''}`}
        >
          <div className="bg-[#FEF08A] border border-amber-300 rounded-t-2xl px-3 py-1.5 flex items-center justify-between text-[11px] font-black tracking-wider uppercase text-[#854D0E] shadow-xs">
            <div className="flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-700" />
              <span>GRAND FINAL (GOLD)</span>
            </div>
            {isAdminMode && (
              <span className="text-[9px] font-mono bg-amber-200/80 px-1.5 py-0.5 rounded font-bold">
                Edit
              </span>
            )}
          </div>

          <div
            className={`bg-white rounded-b-2xl border-2 p-3 shadow-md space-y-2 ${
              isLive
                ? 'border-red-400 ring-2 ring-red-400/50 bg-gradient-to-r from-red-50/50 to-white'
                : 'border-amber-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="bg-[#006A6A] text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">
                {gf.court || 'Court 1'}
              </span>
              {renderStatusBadge(gf.status)}
            </div>

            <div className="space-y-1.5">
              {/* Team 1 */}
              <div
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-colors ${
                  gf.team1.isWinner
                    ? 'bg-[#FEF3C7] border border-amber-300 text-[#191C1C] font-bold'
                    : 'text-[#475569] font-medium'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 pr-1">
                  {gf.team1.isWinner && (
                    <Trophy className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <img
                    src={lookupPlayerPhoto(gf.team1.name || gf.team1.players)}
                    alt={gf.team1.name}
                    className="w-5 h-5 rounded-full object-cover border border-amber-300 shrink-0 shadow-xs"
                  />
                  <span className="truncate text-xs">{gf.team1.name}</span>
                </div>
                <span className="font-mono text-sm font-black shrink-0">
                  {gf.team1.score}
                </span>
              </div>

              {/* Team 2 */}
              <div
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-colors ${
                  gf.team2.isWinner
                    ? 'bg-[#FEF3C7] border border-amber-300 text-[#191C1C] font-bold'
                    : 'text-[#475569] font-medium'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 pr-1">
                  {gf.team2.isWinner && (
                    <Trophy className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <img
                    src={lookupPlayerPhoto(gf.team2.name || gf.team2.players)}
                    alt={gf.team2.name}
                    className="w-5 h-5 rounded-full object-cover border border-amber-300 shrink-0 shadow-xs"
                  />
                  <span className="truncate text-xs">{gf.team2.name}</span>
                </div>
                <span className="font-mono text-sm font-bold shrink-0">
                  {gf.team2.score}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-[10px]">
              <span className="text-[#6F7978] font-mono">
                {gf.roundTitle || 'Grand Final'}
              </span>
              <span className="font-mono font-bold text-[#006A6A]">
                {gf.time || '16:30'}
              </span>
            </div>
          </div>
        </div>

        {/* Perebutan Juara 3 Card */}
        {bm && (
          <div
            onClick={() => isAdminMode && onEditMatch && onEditMatch(bm, 'bronzeMatch')}
            className={`${customWidthClass} ${isAdminMode ? 'cursor-pointer' : ''}`}
          >
            <div className="bg-[#FFEDD5] border border-orange-300 rounded-t-2xl px-3 py-1.5 flex items-center justify-between text-[11px] font-black tracking-wider uppercase text-[#9A3412] shadow-xs">
              <div className="flex items-center gap-1.5">
                <span>🥉</span>
                <span>PEREBUTAN JUARA 3</span>
              </div>
              {isAdminMode && (
                <span className="text-[9px] font-mono bg-orange-200/80 px-1.5 py-0.5 rounded font-bold">
                  Edit
                </span>
              )}
            </div>

            <div className="bg-white rounded-b-2xl border-2 border-orange-300 p-3 shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="bg-[#006A6A] text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">
                  {bm.court || 'Court 2'}
                </span>
                {renderStatusBadge(bm.status)}
              </div>

              <div className="space-y-1.5">
                {/* Team 1 */}
                <div
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-colors ${
                    bm.team1.isWinner
                      ? 'bg-[#FEF3C7] border border-amber-300 text-[#191C1C] font-bold'
                      : 'text-[#475569] font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-1">
                    {bm.team1.isWinner && (
                      <Trophy className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <img
                      src={lookupPlayerPhoto(bm.team1.name || bm.team1.players)}
                      alt={bm.team1.name}
                      className="w-5 h-5 rounded-full object-cover border border-orange-300 shrink-0 shadow-xs"
                    />
                    <span className="truncate text-xs">{bm.team1.name}</span>
                  </div>
                  <span className="font-mono text-sm font-black shrink-0">
                    {bm.team1.score}
                  </span>
                </div>

                {/* Team 2 */}
                <div
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-colors ${
                    bm.team2.isWinner
                      ? 'bg-[#FEF3C7] border border-amber-300 text-[#191C1C] font-bold'
                      : 'text-[#475569] font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-1">
                    {bm.team2.isWinner && (
                      <Trophy className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <img
                      src={lookupPlayerPhoto(bm.team2.name || bm.team2.players)}
                      alt={bm.team2.name}
                      className="w-5 h-5 rounded-full object-cover border border-orange-300 shrink-0 shadow-xs"
                    />
                    <span className="truncate text-xs">{bm.team2.name}</span>
                  </div>
                  <span className="font-mono text-sm font-bold shrink-0">
                    {bm.team2.score}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-[10px]">
                <span className="text-[#6F7978] font-mono">
                  {bm.roundTitle || 'Perebutan Tempat ke-3'}
                </span>
                <span className="font-mono font-bold text-[#006A6A]">
                  {bm.time || '15:15'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
};
