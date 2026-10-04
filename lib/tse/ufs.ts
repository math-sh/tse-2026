/**
 * As 27 unidades federativas, com o código do IBGE.
 *
 * O código do IBGE é a chave de junção com a malha geográfica: o GeoJSON do IBGE
 * traz `properties.codarea` ("11".."53"), e o TSE indexa tudo por sigla. Esta
 * tabela é a ponte entre os dois. É estática de propósito — 27 linhas que não
 * mudam valem mais que uma chamada de API no dia da eleição.
 */

export interface Uf {
  sigla: string;
  nome: string;
  ibge: string;
  regiao: "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
}

export const UFS: readonly Uf[] = [
  { sigla: "ac", nome: "Acre", ibge: "12", regiao: "Norte" },
  { sigla: "al", nome: "Alagoas", ibge: "27", regiao: "Nordeste" },
  { sigla: "am", nome: "Amazonas", ibge: "13", regiao: "Norte" },
  { sigla: "ap", nome: "Amapá", ibge: "16", regiao: "Norte" },
  { sigla: "ba", nome: "Bahia", ibge: "29", regiao: "Nordeste" },
  { sigla: "ce", nome: "Ceará", ibge: "23", regiao: "Nordeste" },
  { sigla: "df", nome: "Distrito Federal", ibge: "53", regiao: "Centro-Oeste" },
  { sigla: "es", nome: "Espírito Santo", ibge: "32", regiao: "Sudeste" },
  { sigla: "go", nome: "Goiás", ibge: "52", regiao: "Centro-Oeste" },
  { sigla: "ma", nome: "Maranhão", ibge: "21", regiao: "Nordeste" },
  { sigla: "mg", nome: "Minas Gerais", ibge: "31", regiao: "Sudeste" },
  { sigla: "ms", nome: "Mato Grosso do Sul", ibge: "50", regiao: "Centro-Oeste" },
  { sigla: "mt", nome: "Mato Grosso", ibge: "51", regiao: "Centro-Oeste" },
  { sigla: "pa", nome: "Pará", ibge: "15", regiao: "Norte" },
  { sigla: "pb", nome: "Paraíba", ibge: "25", regiao: "Nordeste" },
  { sigla: "pe", nome: "Pernambuco", ibge: "26", regiao: "Nordeste" },
  { sigla: "pi", nome: "Piauí", ibge: "22", regiao: "Nordeste" },
  { sigla: "pr", nome: "Paraná", ibge: "41", regiao: "Sul" },
  { sigla: "rj", nome: "Rio de Janeiro", ibge: "33", regiao: "Sudeste" },
  { sigla: "rn", nome: "Rio Grande do Norte", ibge: "24", regiao: "Nordeste" },
  { sigla: "ro", nome: "Rondônia", ibge: "11", regiao: "Norte" },
  { sigla: "rr", nome: "Roraima", ibge: "14", regiao: "Norte" },
  { sigla: "rs", nome: "Rio Grande do Sul", ibge: "43", regiao: "Sul" },
  { sigla: "sc", nome: "Santa Catarina", ibge: "42", regiao: "Sul" },
  { sigla: "se", nome: "Sergipe", ibge: "28", regiao: "Nordeste" },
  { sigla: "sp", nome: "São Paulo", ibge: "35", regiao: "Sudeste" },
  { sigla: "to", nome: "Tocantins", ibge: "17", regiao: "Norte" },
] as const;

export const SIGLAS: readonly string[] = UFS.map((u) => u.sigla);

const POR_SIGLA = new Map(UFS.map((u) => [u.sigla, u]));
const POR_IBGE = new Map(UFS.map((u) => [u.ibge, u]));

export const ufPorSigla = (sigla: string): Uf | undefined =>
  POR_SIGLA.get(sigla.toLowerCase());

/** Usado pelo mapa para ligar uma feature do GeoJSON à sigla do TSE. */
export const ufPorIbge = (ibge: string): Uf | undefined => POR_IBGE.get(ibge);

export const ehUfValida = (sigla: string | null | undefined): boolean =>
  !!sigla && POR_SIGLA.has(sigla.toLowerCase());
