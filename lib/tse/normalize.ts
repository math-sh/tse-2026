/**
 * Converte o boletim cru do TSE no modelo de domínio.
 *
 * Duas decisões que valem explicar:
 *
 * 1. O percentual exibido é o `pvap` do TSE, não um recalculado nosso. É o número
 *    oficial, o mesmo que todo portal mostra, e a largura da barra é derivada
 *    DELE — então rótulo e geometria nunca se contradizem. Recalcular daria
 *    divergência de arredondamento entre o que a barra desenha e o que o rótulo diz.
 *
 * 2. `carg[].agr[].par[].cand[]` é achatado numa lista plana. A hierarquia
 *    agremiação → partido → candidato importa para votos de legenda (que ficam em
 *    `partidos`), mas atrapalha para ranquear, que é o que o dashboard faz sempre.
 */
import type { Cargo } from "./cargos";
import { urlFoto } from "./endpoints";
import { toBool, toDate, toInt, toPct } from "./parse";
import type { RawBoletim, RawMunicipiosConfig } from "./raw-types";

export interface Vice {
  nome: string;
  nomeUrna: string;
  partido: string;
}

export interface Candidato {
  sqcand: string;
  numero: string;
  nome: string;
  nomeUrna: string;
  partido: string;
  partidoNome: string;
  /** Sigla da federação ("PT/PC do B/PV"), quando o partido está em uma. */
  federacao: string | null;
  /** Composição da coligação inteira, quando houver — pode ter 7+ partidos. */
  coligacao: string | null;
  votos: number;
  /** `pvap` do TSE. Também é o que dimensiona a barra. */
  pct: number;
  eleito: boolean;
  situacao: string;
  vices: Vice[];
  fotoUrl: string | null;
}

export interface PartidoTotal {
  sigla: string;
  nome: string;
  federacao: string | null;
  votosNominais: number;
  votosLegenda: number;
  votosTotais: number;
  candidatos: number;
}

export interface Boletim {
  eleicao: string;
  turno: number;
  oficial: boolean;
  nivel: "br" | "uf" | "mu";
  codigoAbrangencia: string;
  /** Hora de geração NO TSE (ISO). É esta que o usuário precisa ver. */
  geradoEm: string | null;
  /** `idg` — muda a cada boletim; serve para deduplicar snapshots. */
  idGeracao: string;

  cargo: { codigo: string; nome: string; vagas: number; proporcional: boolean };

  secoes: { total: number; apuradas: number; pctApuradas: number; naoApuradas: number };

  eleitorado: {
    aptos: number;
    aptosApurados: number;
    comparecimento: number;
    pctComparecimento: number;
    abstencao: number;
    pctAbstencao: number;
  };

  votos: {
    total: number;
    validos: number;
    pctValidos: number;
    nominais: number;
    legenda: number;
    brancos: number;
    pctBrancos: number;
    nulos: number;
    pctNulos: number;
  };

  candidatos: Candidato[];
  partidos: PartidoTotal[];
}

export function normalizarBoletim(
  bruto: RawBoletim,
  cargo: Cargo,
  uf?: string | null,
): Boletim {
  // Pedimos um cargo por arquivo, então `carg` tem um elemento; ainda assim
  // procuramos pelo código, para não assumir ordem.
  const cargoBruto =
    bruto.carg?.find((c) => c.cd === cargo.codigo) ?? bruto.carg?.[0];

  const candidatos: Candidato[] = [];
  const partidos: PartidoTotal[] = [];

  // Federações vêm listadas no cargo e são referenciadas por `partido.nfed`.
  // Já `agremiacao.com` é a composição da COLIGAÇÃO inteira — confundir as duas
  // faria o chip de um candidato mostrar sete siglas.
  const federacoes = new Map((cargoBruto?.fed ?? []).map((f) => [f.n, f.sg]));

  for (const agremiacao of cargoBruto?.agr ?? []) {
    for (const partido of agremiacao.par ?? []) {
      const federacao = partido.nfed ? federacoes.get(partido.nfed) ?? null : null;
      const coligacao =
        agremiacao.com && agremiacao.com !== partido.sg && agremiacao.com !== federacao
          ? agremiacao.com
          : null;

      let nominaisDoPartido = 0;

      for (const cand of partido.cand ?? []) {
        const votos = toInt(cand.vap);
        nominaisDoPartido += votos;
        candidatos.push({
          sqcand: cand.sqcand,
          numero: cand.n,
          nome: cand.nm,
          nomeUrna: cand.nmu || cand.nm,
          partido: partido.sg,
          partidoNome: partido.nm,
          federacao,
          coligacao,
          votos,
          pct: toPct(cand.pvap),
          eleito: toBool(cand.e),
          situacao: cand.st ?? "",
          vices: (cand.vs ?? []).map((v) => ({
            nome: v.nm,
            nomeUrna: v.nmu || v.nm,
            partido: v.sgp,
          })),
          fotoUrl: urlFoto(cargo, cand.sqcand, uf),
        });
      }

      const legenda = toInt(partido.tvtn);
      partidos.push({
        sigla: partido.sg,
        nome: partido.nm,
        federacao,
        votosNominais: nominaisDoPartido,
        votosLegenda: legenda,
        votosTotais: nominaisDoPartido + legenda,
        candidatos: partido.cand?.length ?? 0,
      });
    }
  }

  // Empate é possível (e no início, com tudo em zero, é a regra). Desempatar
  // pelo número da urna mantém a ordem estável entre atualizações, em vez de
  // fazer as barras dançarem a cada polling.
  candidatos.sort((a, b) => b.votos - a.votos || a.numero.localeCompare(b.numero, undefined, { numeric: true }));
  partidos.sort((a, b) => b.votosTotais - a.votosTotais || a.sigla.localeCompare(b.sigla));

  const s = bruto.s;
  const e = bruto.e;
  const v = bruto.v;

  const nominais = toInt(v?.vnom);
  const validos = toInt(v?.vv);

  return {
    eleicao: bruto.ele,
    turno: toInt(bruto.t) || 1,
    oficial: bruto.f === "o",
    nivel: bruto.tpabr,
    codigoAbrangencia: bruto.cdabr,
    geradoEm: toDate(bruto.dg, bruto.hg),
    idGeracao: bruto.idg,

    cargo: {
      codigo: cargo.codigo,
      nome: cargoBruto?.nmn ?? cargo.nome,
      vagas: toInt(cargoBruto?.nv),
      proporcional: cargo.proporcional,
    },

    secoes: {
      total: toInt(s?.ts),
      apuradas: toInt(s?.st),
      pctApuradas: toPct(s?.pst),
      naoApuradas: toInt(s?.snt),
    },

    eleitorado: {
      aptos: toInt(e?.te),
      aptosApurados: toInt(e?.est),
      comparecimento: toInt(e?.c),
      pctComparecimento: toPct(e?.pc),
      abstencao: toInt(e?.a),
      pctAbstencao: toPct(e?.pa),
    },

    votos: {
      total: toInt(v?.tv),
      validos,
      pctValidos: toPct(v?.pvv),
      nominais,
      legenda: Math.max(0, validos - nominais),
      brancos: toInt(v?.vb),
      pctBrancos: toPct(v?.pvb),
      nulos: toInt(v?.vn),
      pctNulos: toPct(v?.pvn),
    },

    candidatos,
    partidos,
  };
}

export interface Municipio {
  codigo: string;
  ibge: string;
  nome: string;
  uf: string;
}

export function normalizarMunicipios(bruto: RawMunicipiosConfig): Municipio[] {
  const lista: Municipio[] = [];
  for (const abrangencia of bruto.abr ?? []) {
    for (const mu of abrangencia.mu ?? []) {
      lista.push({
        codigo: mu.cd,
        ibge: mu.cdi,
        nome: mu.nm,
        uf: abrangencia.cd,
      });
    }
  }
  return lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
