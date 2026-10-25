/**
 * Registro de cargos — a fonte única de verdade sobre o que existe e onde.
 *
 * Configuração do 2º turno (25/10/2026), conferida contra
 * `comum/config/ele-c.json` em 25/10/2026: Presidente é a eleição 6258 e
 * Governador é a 6260. Pedir um cargo no nível errado devolve 404 no TSE, então
 * toda montagem de URL passa por aqui.
 */

export const CICLO = "ele2026";
export const TURNO = 2;

/** Rótulos do turno, para não espalhar a data por vários componentes. */
export const ROTULO_TURNO = `${TURNO}º turno`;
export const DATA_TURNO = "25 de outubro";

/** Presidente — 2º turno. */
export const ELE_FEDERAL = "6258";
/** Governador — 2º turno. Só há disputa nos estados de `GOVERNOS_2O_TURNO`. */
export const ELE_ESTADUAL = "6260";

/** Códigos do 1º turno, mantidos para conferência em `/api/tse/eleicoes`. */
export const ELEICOES_1O_TURNO = {
  federal: "6257",
  estadual: "6259",
  municipal: "6261",
} as const;

export const ELEICOES_2O_TURNO = { federal: ELE_FEDERAL, estadual: ELE_ESTADUAL } as const;

/**
 * Estados com 2º turno para governador, segundo o `abr` da eleição 6260 no
 * config do TSE. Fora daqui o TSE não publica o cargo — o seletor e o mapa usam
 * esta lista para não marcar as demais UFs como "indisponíveis".
 */
export const GOVERNOS_2O_TURNO = ["ac", "am", "df", "es", "rn", "to"] as const;

export type Nivel = "br" | "uf" | "mu";

export interface Cargo {
  codigo: string;
  eleicao: string;
  nome: string;
  nomeCurto: string;
  /** Níveis de abrangência em que o TSE publica este cargo. */
  niveis: Nivel[];
  /** Proporcional = centenas de candidatos; exige dobrar a cauda em "Outros". */
  proporcional: boolean;
  /** Fotos em /fotos/br/ (cargo nacional) ou em /fotos/{uf}/. */
  fotoNacional: boolean;
  /**
   * O cargo só existe nestas UFs — sem UF escolhida ele nem aparece no seletor
   * (Dep. Distrital). Para a disputa de um turno em algumas UFs, ver
   * `ufsComDisputa`.
   */
  apenasUfs?: readonly string[];
  /**
   * O cargo é publicado só nestas UFs, mas continua selecionável no nível
   * Brasil para o mapa. Governador no 2º turno: disputa em 6 estados, e as
   * demais UFs aparecem como não elegíveis.
   */
  ufsComDisputa?: readonly string[];
  excetoUfs?: readonly string[];
  /** Código TSE do único município onde o cargo existe. */
  apenasMunicipio?: string;
}

export const CARGOS: readonly Cargo[] = [
  {
    codigo: "1", eleicao: ELE_FEDERAL, nome: "Presidente", nomeCurto: "Presidente",
    niveis: ["br", "uf", "mu"], proporcional: false, fotoNacional: true,
  },
  {
    // No 2º turno o TSE publica Governador só no nível estado, e só nos seis
    // estados com disputa: não existe arquivo municipal para a eleição 6260.
    codigo: "3", eleicao: ELE_ESTADUAL, nome: "Governador", nomeCurto: "Governador",
    niveis: ["uf"], proporcional: false, fotoNacional: false, ufsComDisputa: GOVERNOS_2O_TURNO,
  },
] as const;

const POR_CODIGO = new Map(CARGOS.map((c) => [c.codigo, c]));

export const cargoPorCodigo = (codigo: string): Cargo | undefined => POR_CODIGO.get(codigo);

export const CARGO_PADRAO = CARGOS[0];

/** O nível de abrangência que um recorte de filtros representa. */
export function nivelDe(uf?: string | null, municipio?: string | null): Nivel {
  if (municipio) return "mu";
  if (uf) return "uf";
  return "br";
}

/** Os cargos que fazem sentido oferecer para um recorte — o que alimenta o seletor. */
export function cargosPara(uf?: string | null, municipio?: string | null): Cargo[] {
  const nivel = nivelDe(uf, municipio);
  const sigla = uf?.toLowerCase();
  return CARGOS.filter((c) => {
    if (!c.niveis.includes(nivel)) return false;
    if (sigla && c.apenasUfs && !c.apenasUfs.includes(sigla)) return false;
    if (sigla && c.ufsComDisputa && !c.ufsComDisputa.includes(sigla)) return false;
    if (sigla && c.excetoUfs?.includes(sigla)) return false;
    // Sem UF escolhida, um cargo restrito a certas UFs não deve aparecer.
    if (!sigla && c.apenasUfs) return false;
    if (c.apenasMunicipio && municipio && municipio !== c.apenasMunicipio) return false;
    if (c.apenasMunicipio && !municipio) return false;
    return true;
  });
}

/** Valida o trio cargo+uf+município antes de montar qualquer URL. */
export function validarRecorte(
  codigo: string,
  uf?: string | null,
  municipio?: string | null,
): { ok: true; cargo: Cargo; nivel: Nivel } | { ok: false; erro: string } {
  const cargo = cargoPorCodigo(codigo);
  if (!cargo) return { ok: false, erro: `Cargo ${codigo} não existe nesta eleição.` };

  const nivel = nivelDe(uf, municipio);
  if (!cargo.niveis.includes(nivel)) {
    const nomes: Record<Nivel, string> = { br: "Brasil", uf: "estado", mu: "município" };
    return {
      ok: false,
      erro: `${cargo.nome} não é publicado no nível ${nomes[nivel]}. Níveis válidos: ${cargo.niveis.map((n) => nomes[n]).join(", ")}.`,
    };
  }

  const sigla = uf?.toLowerCase();
  if (sigla && cargo.apenasUfs && !cargo.apenasUfs.includes(sigla)) {
    return { ok: false, erro: `${cargo.nome} só existe em ${cargo.apenasUfs.join(", ").toUpperCase()}.` };
  }
  if (sigla && cargo.ufsComDisputa && !cargo.ufsComDisputa.includes(sigla)) {
    return {
      ok: false,
      erro: `${cargo.nome} não tem disputa em ${sigla.toUpperCase()} neste turno.`,
    };
  }
  if (sigla && cargo.excetoUfs?.includes(sigla)) {
    return { ok: false, erro: `${cargo.nome} não existe em ${sigla.toUpperCase()}.` };
  }
  if (cargo.apenasMunicipio && municipio !== cargo.apenasMunicipio) {
    return { ok: false, erro: `${cargo.nome} só existe no município ${cargo.apenasMunicipio}.` };
  }

  return { ok: true, cargo, nivel };
}
