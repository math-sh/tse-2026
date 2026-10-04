/**
 * O TSE serve TODO valor numérico como string, e os decimais vêm com vírgula.
 * `Number("41,20")` é NaN — é daqui que nasce a maior parte dos bugs silenciosos
 * de quem consome essa API. Nada neste projeto deve chamar Number() direto num
 * campo do TSE; use estas funções.
 */

/** `"158745502"` → `158745502`. Tolera separador de milhar e string vazia. */
export function toInt(valor: string | undefined | null): number {
  if (!valor) return 0;
  const limpo = valor.replace(/[^\d-]/g, "");
  if (!limpo) return 0;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

/** `"41,20"` → `41.2`. Decimal em vírgula, como o TSE manda. */
export function toPct(valor: string | undefined | null): number {
  if (!valor) return 0;
  const limpo = valor.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  if (!limpo) return 0;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

/** `"s"` → true. O TSE usa s/n para booleanos (campo `e` = eleito). */
export function toBool(valor: string | undefined | null): boolean {
  return valor === "s" || valor === "S";
}

/**
 * `dg` = "04/10/2026", `hg` = "19:32:10" → Date.
 * Esses campos são a hora de geração NO TSE, que é a que importa para o usuário
 * — não a hora do navegador. Interpretados como horário de Brasília (UTC-3).
 */
export function toDate(dg: string | undefined, hg: string | undefined): string | null {
  if (!dg || !hg) return null;
  const [dia, mes, ano] = dg.split("/");
  if (!dia || !mes || !ano) return null;
  const iso = `${ano}-${mes}-${dia}T${hg}-03:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const NF_INT = new Intl.NumberFormat("pt-BR");
const NF_PCT = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const fmtInt = (n: number): string => NF_INT.format(Math.round(n));
export const fmtPct = (n: number): string => `${NF_PCT.format(n)}%`;

/** Compacta números grandes para o modo telão: 158745502 → "158,7 mi". */
export function fmtCompacto(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n / 1_000_000)} mi`;
  }
  if (Math.abs(n) >= 10_000) {
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n / 1_000)} mil`;
  }
  return fmtInt(n);
}
