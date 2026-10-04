/**
 * Tipos do JSON cru do TSE. Todo campo é `string` — isso não é descuido na
 * tipagem, é como a API realmente responde. A conversão acontece em normalize.ts.
 */

export interface RawCandidato {
  n: string;          // número na urna
  sqcand: string;     // sequencial único — chave estável e id da foto
  nm: string;         // nome completo
  nmu: string;        // nome de urna (o que se mostra)
  dt?: string;        // nascimento
  seq?: string;
  e?: string;         // eleito: "s" | "n"
  st?: string;        // situação
  vap: string;        // votos apurados
  pvap: string;       // % de votos — "41,20"
  pvapn?: string;
  vs?: RawVice[];     // vice / suplentes
}

export interface RawVice {
  tp?: string;
  sqcand: string;
  nm: string;
  nmu: string;
  sgp: string;        // sigla do partido
}

export interface RawPartido {
  n: string;          // número do partido
  sg: string;         // sigla
  nm: string;         // nome
  nfed?: string;      // número da federação, se houver
  tvtn?: string;      // total de votos de legenda
  tvan?: string;
  cand: RawCandidato[];
}

export interface RawAgremiacao {
  n: string;
  nm: string;
  tp?: string;
  com?: string;       // composição (sigla ou siglas da federação)
  par: RawPartido[];
}

export interface RawFederacao {
  n: string;
  sg: string;
  nm: string;
  com?: string;
}

export interface RawCargo {
  cd: string;         // código do cargo
  nmn: string;        // nome neutro
  nmm?: string;
  nmf?: string;
  nv: string;         // número de vagas
  fed?: RawFederacao[];
  agr: RawAgremiacao[];
}

/** Seções (urnas). `st` = apuradas, `ts` = total. */
export interface RawSecoes {
  ts: string; st: string; pst: string; pstn: string;
  snt: string; psnt: string;
  si?: string; sni?: string; sa?: string; sna?: string;
}

/** Eleitorado. `te` = aptos, `c` = comparecimento, `a` = abstenção. */
export interface RawEleitorado {
  te: string; est: string; pest: string;
  esnt: string; pesnt: string;
  c: string; pc: string;
  a: string; pa: string;
}

/** Votos. `vv` válidos, `vnom` nominais, `vb` brancos, `vn` nulos. */
export interface RawVotos {
  tv: string;
  vvc?: string; pvvc?: string;
  vv: string; pvv: string;
  vnom: string; pvnom: string;
  van?: string; vansj?: string;
  vb: string; pvb: string;
  tvn?: string; ptvn?: string;
  vn: string; pvn: string;
  vnt?: string; pvnt?: string;
}

/** O boletim completo: o arquivo `-u.json`. */
export interface RawBoletim {
  ele: string;        // código da eleição
  t: string;          // turno
  f: string;          // "o" = oficial
  tpabr: "br" | "uf" | "mu";
  cdabr: string;
  dg: string;         // data de geração no TSE
  hg: string;         // hora de geração no TSE
  idg: string;        // id da geração — serve para deduplicar snapshots
  carg: RawCargo[];
  s: RawSecoes;
  e: RawEleitorado;
  v: RawVotos;
}

/** `config/mun-e{ele}-cm.json` */
export interface RawMunicipiosConfig {
  dg: string; hg: string; idg: string; f: string;
  abr: Array<{
    cd: string;       // sigla da UF
    ds: string;       // nome da UF
    mu: Array<{
      cd: string;     // código TSE (5 dígitos) — é este que entra na URL
      cdi: string;    // código IBGE
      nm: string;
      c?: string;
      z?: string[];
    }>;
  }>;
}
