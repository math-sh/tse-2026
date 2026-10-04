/**
 * Tipos do resumo do mapa. Separados de servico.ts (que é server-only) para que
 * os componentes de cliente possam importá-los.
 */

export interface ResumoCandidato {
  sqcand: string;
  nomeUrna: string;
  partido: string;
  numero: string;
  votos: number;
  pct: number;
}

export interface ResumoUf {
  uf: string;
  nome: string;
  ibge: string;
  /** A UF elege este cargo? (DF não elege Dep. Estadual, por exemplo.) */
  elegivel: boolean;
  /** O boletim chegou? false = elegível mas falhou, ou não elegível. */
  disponivel: boolean;
  pctApurado: number;
  secoesApuradas: number;
  secoesTotal: number;
  eleitorado: number;
  comparecimento: number;
  pctAbstencao: number;
  lider: ResumoCandidato | null;
  segundo: ResumoCandidato | null;
  /** Vantagem do líder sobre o segundo, em pontos percentuais. */
  margem: number | null;
}

export interface Mapa {
  cargo: { codigo: string; nome: string };
  /** Quando false, o mapa pinta por % apurado — ver obterMapa em servico.ts. */
  agregavel: boolean;
  /**
   * Ranking nacional. `fonte: "brasil"` = boletim Brasil oficial (inclui o
   * exterior); `"soma-ufs"` = plano B quando o boletim Brasil falha.
   */
  nacional: (ResumoCandidato & { fonte: "brasil" | "soma-ufs" })[];
  estados: ResumoUf[];
  indisponiveis: string[];
}
