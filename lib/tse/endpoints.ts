/**
 * Montagem das URLs do TSE.
 *
 * A regra de `ufDir` / `abr` é a parte que mais gera 404:
 *
 *   Brasil     → /dados/br/br-c0001-e006257-u.json
 *   Estado     → /dados/sp/sp-c0003-e006259-u.json
 *   Município  → /dados/sp/sp71072-c0003-e006259-u.json   (sigla + código TSE)
 *
 * E as fotos seguem a UF do REGISTRO da candidatura, não a abrangência consultada:
 * Presidente em /fotos/br/, Governador de SP em /fotos/sp/. O mesmo sqcand na
 * pasta errada devolve 404.
 */
import { CICLO, type Cargo, type Nivel } from "./cargos";

/**
 * `TSE_BASE_URL` existe para testes e espelhos locais — no uso normal fica vazio
 * e o app fala direto com o TSE. Só é lida no servidor.
 */
export const BASE = process.env.TSE_BASE_URL || "https://resultados.tse.jus.br/oficial";

/** Códigos vão zero-padded: cargo em 4 dígitos, eleição em 6. */
const pad = (v: string, n: number) => v.padStart(n, "0");

export const urlEleicoes = (): string => `${BASE}/comum/config/ele-c.json`;

export const urlMunicipios = (eleicao: string): string =>
  `${BASE}/${CICLO}/${eleicao}/config/mun-e${pad(eleicao, 6)}-cm.json`;

export interface Recorte {
  cargo: Cargo;
  nivel: Nivel;
  uf?: string | null;
  municipio?: string | null;
}

export function urlResultado({ cargo, nivel, uf, municipio }: Recorte): string {
  const sigla = uf?.toLowerCase();
  let ufDir: string;
  let abr: string;

  switch (nivel) {
    case "br":
      ufDir = "br";
      abr = "br";
      break;
    case "uf":
      if (!sigla) throw new Error("Nível estado exige uma UF.");
      ufDir = sigla;
      abr = sigla;
      break;
    case "mu":
      if (!sigla) throw new Error("Nível município exige a UF do município.");
      if (!municipio) throw new Error("Nível município exige o código do município.");
      ufDir = sigla;
      abr = `${sigla}${municipio}`;
      break;
  }

  const arquivo = `${abr}-c${pad(cargo.codigo, 4)}-e${pad(cargo.eleicao, 6)}-u.json`;
  return `${BASE}/${CICLO}/${cargo.eleicao}/dados/${ufDir}/${arquivo}`;
}

/** A foto mora na UF do registro: `br` para cargo nacional, a sigla nos demais. */
export function urlFoto(cargo: Cargo, sqcand: string, uf?: string | null): string | null {
  if (!sqcand) return null;
  const dir = cargo.fotoNacional ? "br" : uf?.toLowerCase();
  if (!dir) return null;
  return `${BASE}/${CICLO}/${cargo.eleicao}/fotos/${dir}/${sqcand}.jpeg`;
}
