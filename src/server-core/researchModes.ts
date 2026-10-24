export type ResearchMode = 'solo' | 'trio' | 'deep';
export type ResearchProtocol = 'solo' | 'trio' | 'quad';

export interface ResearchModePlan {
  mode: ResearchMode;
  protocol: ResearchProtocol;
  rounds: 1 | 3 | 4;
  requiredSeats: Array<'architect' | 'skeptic' | 'verifier' | 'arbiter'>;
}

/** Resolve modern mode values and older selectedRound values without silently degrading Deep. */
export function resolveResearchMode(protocolValue: unknown, selectedRoundValue: unknown): ResearchModePlan {
  const protocol = typeof protocolValue === 'string' ? protocolValue.toLowerCase() : '';
  const rounds = Number(selectedRoundValue);
  let mode: ResearchMode;
  if (Number.isFinite(rounds) && rounds >= 4 || protocol === 'quad' || protocol === 'deep') mode = 'deep';
  else if (Number.isFinite(rounds) && rounds > 1 || protocol === 'trio' || protocol === 'standard') mode = 'trio';
  else mode = 'solo';

  if (mode === 'solo') return { mode, protocol: 'solo', rounds: 1, requiredSeats: ['architect'] };
  if (mode === 'trio') return { mode, protocol: 'trio', rounds: 3, requiredSeats: ['architect', 'skeptic', 'arbiter'] };
  return { mode, protocol: 'quad', rounds: 4, requiredSeats: ['architect', 'skeptic', 'verifier', 'arbiter'] };
}

export function findMissingResearchSeats(
  seats: Record<string, { provider?: unknown; model?: unknown }> | null | undefined,
  requiredSeats: string[],
): string[] {
  return requiredSeats.filter((seat) => {
    const value = seats?.[seat];
    return typeof value?.provider !== 'string' || !value.provider.trim()
      || typeof value?.model !== 'string' || !value.model.trim();
  });
}
