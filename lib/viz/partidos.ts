/**
 * Cores partidárias — a cor de identidade do candidato.
 *
 * Usadas nas barras, na linha do tempo, no mapa por líder e no chip ao lado do
 * nome. A cor segue o partido, não a colocação: uma ultrapassagem no ranking
 * não repinta ninguém.
 *
 * Alguns partidos compartilham o mesmo matiz (PT, PCB, PSTU e PCO são
 * vermelhos; PL, PSD e PSDB são azuis). A diferenciação fica com o nome, a
 * sigla, o tooltip e a tabela — a cor nunca é o único canal de identidade.
 *
 * Partido sem cor mapeada cai no cinza de retração.
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

/** Compara siglas sem acento, caixa ou pontuação: "PC do B" e "PCdoB" acham a mesma cor. */
const normalizarSigla = (sigla: string) =>
  sigla
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();

const CORES_POR_SIGLA = new Map(
  Object.entries(CORES).map(([sigla, cor]) => [normalizarSigla(sigla), cor]),
);

/** Cor do partido. Aceita sigla de partido ou de federação. */
export function corPartido(sigla: string): string {
  if (!sigla) return "var(--de-emphasis)";
  // Federação vem como "PT/PC do B/PV": usa a cor do primeiro partido.
  const primeiro = sigla.split("/")[0];
  return (
    CORES_POR_SIGLA.get(normalizarSigla(primeiro)) ??
    CORES_POR_SIGLA.get(normalizarSigla(sigla)) ??
    "var(--de-emphasis)"
  );
}
