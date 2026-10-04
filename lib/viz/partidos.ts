/**
 * Cores partidárias — usadas APENAS no chip ao lado do nome.
 *
 * Não entram no preenchimento das barras, e o motivo é concreto: PT, PCB, PSTU e
 * PCO são todos vermelhos, PL e PSD são ambos azuis. Com 12 presidenciáveis em
 * cor de partido, metade do gráfico fica indistinguível — e sob daltonismo,
 * pior ainda. O chip dá a familiaridade da cor partidária sem deixar a leitura
 * do gráfico depender dela.
 *
 * Partido sem cor mapeada cai no cinza de retração, que é um resultado
 * aceitável para um chip de 8px.
 */
const CORES: Record<string, string> = {
  PT: "#c4122f", PL: "#1b3f8b", PSD: "#1f5aa8", MDB: "#1a9b4c", PSDB: "#0a6cb3",
  UNIÃO: "#1c3f94", PP: "#1e5bb8", REPUBLICANOS: "#1b5e9c", PDT: "#d6242c",
  PSB: "#e63329", PSOL: "#9b1b30", PCdoB: "#b01020", PV: "#178a3a",
  NOVO: "#f26522", PSTU: "#b31217", PCB: "#a3121e", PCO: "#8c1018",
  AVANTE: "#1f7a8c", PODE: "#1a4f9c", CIDADANIA: "#e2007a", REDE: "#0f8a7e",
  SOLIDARIEDADE: "#f28a00", PRD: "#13497e", PMB: "#1f9a6e", DC: "#1b6bb0",
  AGIR: "#2a7fbf", MOBILIZA: "#2f8f4f", UP: "#c0171f", PRTB: "#1d5f3f",
  DEMOCRATA: "#15467c", MISSÃO: "#2b6f5a",
};

/** Cor do chip partidário. Aceita sigla de partido ou de federação. */
export function corPartido(sigla: string): string {
  if (!sigla) return "var(--de-emphasis)";
  // Federação vem como "PT/PC do B/PV": o chip usa a cor do primeiro partido.
  const primeiro = sigla.split("/")[0].trim().toUpperCase();
  return CORES[primeiro] ?? CORES[sigla.toUpperCase()] ?? "var(--de-emphasis)";
}
