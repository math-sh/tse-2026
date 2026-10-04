/**
 * Acesso à paleta validada, por papel.
 *
 * Por que as barras de candidato usam UM matiz só, e não oito:
 *
 * A regra do design system é "a cor segue a entidade, nunca a posição". Num
 * ranking de apuração ao vivo a posição muda a cada boletim — se a cor fosse por
 * colocação, os candidatos trocariam de cor quando um ultrapassasse o outro, que
 * é exatamente o que a regra proíbe. E a tabela de formas do próprio design
 * system manda matiz único para "comparar magnitude": num ranking o comprimento
 * da barra já carrega o valor, e a identidade vem do rótulo direto (foto, nome,
 * partido, número) mais o chip partidário.
 *
 * A cor categórica fica onde as séries realmente SÃO o assunto e o conjunto é
 * estável: composição dos votos, linha do tempo e líder no mapa. Nesses casos o
 * slot é atribuído por identidade (sqcand), com `slotsEstaveis`, para que uma
 * virada no ranking não repinte ninguém.
 */

/** Os 8 slots categóricos, em ordem fixa. Nunca ciclar; nunca gerar um 9º. */
export const SERIES = [
  "var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)",
  "var(--series-5)", "var(--series-6)", "var(--series-7)", "var(--series-8)",
] as const;

/**
 * No coroplético e em small multiples vale o critério de TODOS os pares, onde só
 * os três primeiros slots passam. Acima de três, dobrar em "demais".
 */
export const SERIES_MAPA = SERIES.slice(0, 3);

export const MAX_SERIES = SERIES.length;
export const MAX_SERIES_MAPA = SERIES_MAPA.length;

export const DE_EMPHASIS = "var(--de-emphasis)";
export const BARRA = "var(--seq-400)";
export const BARRA_LIDER = "var(--seq-500)";
export const NEUTRO = "var(--neutral-mid)";

export const INK = "var(--text-primary)";
export const INK_2 = "var(--text-secondary)";
export const INK_MUTED = "var(--text-muted)";
export const GRID = "var(--grid)";
export const BASELINE = "var(--baseline)";
export const SURFACE = "var(--surface-1)";

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

/**
 * Liga cada identidade a um slot de forma determinística.
 *
 * A ordenação é pela própria chave, não pela colocação: assim o candidato 13
 * recebe sempre o mesmo matiz, e uma ultrapassagem no ranking não repinta o
 * gráfico. Quem ficar fora dos slots recebe o cinza de retração.
 */
export function slotsEstaveis(
  chaves: readonly string[],
  limite: number = MAX_SERIES,
): Map<string, string> {
  const paleta = limite <= MAX_SERIES_MAPA ? SERIES_MAPA : SERIES;
  const ordenadas = [...new Set(chaves)].sort((a, b) => a.localeCompare(b));
  const mapa = new Map<string, string>();
  ordenadas.forEach((chave, i) => {
    mapa.set(chave, i < limite ? paleta[i % paleta.length] : DE_EMPHASIS);
  });
  return mapa;
}

/**
 * Estende uma atribuição existente sem mexer nela.
 *
 * O mesmo candidato precisa ter a mesma cor no mapa e na linha do tempo. O mapa
 * colore os 3 primeiros do país; a linha do tempo mostra mais séries. Em vez de
 * recalcular do zero (o que poderia trocar a cor de quem já aparece no mapa),
 * os novos recebem os slots ainda livres, também em ordem de chave.
 */
export function estenderSlots(
  base: ReadonlyMap<string, string>,
  chaves: readonly string[],
): Map<string, string> {
  const mapa = new Map(base);
  const usados = new Set(base.values());
  const livres = SERIES.filter((s) => !usados.has(s));
  const novas = [...new Set(chaves)].filter((c) => !mapa.has(c)).sort((a, b) => a.localeCompare(b));
  novas.forEach((chave, i) => mapa.set(chave, livres[i] ?? DE_EMPHASIS));
  return mapa;
}
