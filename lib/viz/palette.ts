/**
 * Tokens de cor dos gráficos.
 *
 * Candidatos não usam slots categóricos: a cor vem do partido, em
 * `lib/viz/partidos.ts`. Aqui ficam as cores de dado que não são identidade de
 * candidato: a rampa sequencial do mapa (% apurado), os neutros e as cores
 * semânticas dos votos.
 */

export const DE_EMPHASIS = "var(--de-emphasis)";
export const NEUTRO = "var(--neutral-mid)";

export const INK = "var(--text-primary)";
export const INK_2 = "var(--text-secondary)";
export const INK_MUTED = "var(--text-muted)";
export const GRID = "var(--grid)";
export const BASELINE = "var(--baseline)";
export const SURFACE = "var(--surface-1)";

/**
 * Cores semânticas dos votos. Nos cargos proporcionais, nominais e legenda são
 * dois tons de verde — ambos continuam sendo votos válidos.
 */
export const VOTO_VALIDO = "var(--voto-valido)";
export const VOTO_VALIDO_2 = "var(--voto-valido-2)";
export const VOTO_BRANCO = "var(--voto-branco)";
export const VOTO_NULO = "var(--voto-nulo)";

const RAMPA = [
  "var(--seq-100)", "var(--seq-200)", "var(--seq-300)",
  "var(--seq-400)", "var(--seq-500)", "var(--seq-600)", "var(--seq-700)",
] as const;

/**
 * Rampa sequencial de um matiz: mais é mais escuro. Para magnitude contínua
 * (% apurado no mapa), onde o passo mais claro significa "perto de zero".
 */
export function corSequencial(fracao: number): string {
  if (!Number.isFinite(fracao) || fracao <= 0) return NEUTRO;
  const i = Math.min(RAMPA.length - 1, Math.floor(fracao * RAMPA.length));
  return RAMPA[i];
}
