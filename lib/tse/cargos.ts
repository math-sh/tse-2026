/**
 * Registro de cargos — a fonte única de verdade sobre o que existe e onde.
 *
 * Códigos confirmados contra `comum/config/ele-c.json` em 04/10/2026 (pleito 3220,
 * ciclo ele2026). Pedir um cargo no nível errado devolve 404 no TSE, então toda
 * montagem de URL passa por aqui.
 */

export const CICLO = "ele2026";
export const TURNO = 1;

/** Presidente. */
export const ELE_FEDERAL = "6257";
/** Governador, Senador, Deputado Federal / Estadual / Distrital. */
export const ELE_ESTADUAL = "6259";
/** Conselheiro Distrital — só Fernando de Noronha. */
export const ELE_MUNICIPAL = "6261";

/**
 * Para virar o 2º turno, troque `ELE_FEDERAL` por 6258 e `ELE_ESTADUAL` por 6260
 * (os `cdt2` declarados no config do TSE) e `TURNO` por 2. Nada mais muda.
 */
export const ELEICOES_2O_TURNO = { [ELE_FEDERAL]: "6258", [ELE_ESTADUAL]: "6260" } as const;

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
  apenasUfs?: readonly string[];
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
    codigo: "3", eleicao: ELE_ESTADUAL, nome: "Governador", nomeCurto: "Governador",
    niveis: ["uf", "mu"], proporcional: false, fotoNacional: false,
  },
  {
    codigo: "5", eleicao: ELE_ESTADUAL, nome: "Senador", nomeCurto: "Senador",
    niveis: ["uf", "mu"], proporcional: false, fotoNacional: false,
  },
  {
    codigo: "6", eleicao: ELE_ESTADUAL, nome: "Deputado Federal", nomeCurto: "Dep. Federal",
    niveis: ["uf", "mu"], proporcional: true, fotoNacional: false,
  },
  {
    // O DF não elege deputado estadual: `c0007` em df responde 404.
    codigo: "7", eleicao: ELE_ESTADUAL, nome: "Deputado Estadual", nomeCurto: "Dep. Estadual",
    niveis: ["uf", "mu"], proporcional: true, fotoNacional: false, excetoUfs: ["df"],
  },
  {
    // ...ele elege distrital, que só existe lá.
    codigo: "8", eleicao: ELE_ESTADUAL, nome: "Deputado Distrital", nomeCurto: "Dep. Distrital",
    niveis: ["uf", "mu"], proporcional: true, fotoNacional: false, apenasUfs: ["df"],
  },
  {
    // Publicado só no nível município: `pe-c0025` dá 404, `pe30015-c0025` dá 200.
    codigo: "25", eleicao: ELE_MUNICIPAL, nome: "Conselheiro Distrital",
    nomeCurto: "Cons. Distrital", niveis: ["mu"], proporcional: true, fotoNacional: false,
    apenasUfs: ["pe"], apenasMunicipio: "30015",
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
  if (sigla && cargo.excetoUfs?.includes(sigla)) {
    return { ok: false, erro: `${cargo.nome} não existe em ${sigla.toUpperCase()}.` };
  }
  if (cargo.apenasMunicipio && municipio !== cargo.apenasMunicipio) {
    return { ok: false, erro: `${cargo.nome} só existe no município ${cargo.apenasMunicipio}.` };
  }

  return { ok: true, cargo, nivel };
}
