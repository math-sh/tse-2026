/**
 * Operações de leitura usadas tanto pelas rotas /api/tse/* quanto pela página
 * renderizada no servidor. A página chama isto direto — não faz HTTP para a
 * própria API — e as rotas são só uma casca de validação + serialização.
 */
import "server-only";
import { validarRecorte } from "./cargos";
import { urlResultado } from "./endpoints";
import { REVALIDATE, TseNaoEncontrado, buscarTse } from "./fetch";
import { normalizarBoletim, type Boletim } from "./normalize";
import type { RawBoletim } from "./raw-types";
import { UFS, ehUfValida } from "./ufs";
import type { Mapa, ResumoCandidato, ResumoUf } from "./tipos-mapa";

export type Resultado<T> =
  | { ok: true; dados: T }
  | { ok: false; status: number; erro: string };

export interface Filtros {
  cargo: string;
  uf: string | null;
  mu: string | null;
}

/** Valida os parâmetros vindos de URL antes de montar qualquer requisição. */
export function validarFiltros(f: Filtros): Resultado<null> {
  if (f.uf && !ehUfValida(f.uf)) return { ok: false, status: 400, erro: `UF inválida: ${f.uf}` };
  if (f.mu && !/^\d{5}$/.test(f.mu)) {
    return { ok: false, status: 400, erro: "Código de município inválido — o TSE usa 5 dígitos." };
  }
  if (f.mu && !f.uf) {
    return {
      ok: false,
      status: 400,
      erro: "Filtrar por município exige a UF: o arquivo do TSE mora na pasta da UF.",
    };
  }
  return { ok: true, dados: null };
}

export async function obterResultado(f: Filtros): Promise<Resultado<Boletim>> {
  const v = validarFiltros(f);
  if (!v.ok) return v;

  const recorte = validarRecorte(f.cargo, f.uf, f.mu);
  if (!recorte.ok) return { ok: false, status: 400, erro: recorte.erro };

  const url = urlResultado({ cargo: recorte.cargo, nivel: recorte.nivel, uf: f.uf, municipio: f.mu });
  try {
    const bruto = await buscarTse<RawBoletim>(url, REVALIDATE.resultado);
    return { ok: true, dados: normalizarBoletim(bruto, recorte.cargo, f.uf) };
  } catch (erro) {
    if (erro instanceof TseNaoEncontrado) {
      return {
        ok: false,
        status: 404,
        erro: "O TSE não publica resultado para esta combinação de cargo e abrangência.",
      };
    }
    return {
      ok: false,
      status: 502,
      erro: erro instanceof Error ? erro.message : "Falha ao consultar o TSE.",
    };
  }
}

/**
 * Ranking nacional para a legenda do mapa.
 *
 * Usa o boletim Brasil oficial, e não a soma das 27 UFs: o total Brasil do TSE
 * inclui os votos do EXTERIOR, que não pertencem a nenhuma UF. Somar as UFs
 * daria um percentual "no país" diferente do oficial. A soma só entra como
 * plano B se o boletim Brasil falhar — e aí o rótulo da legenda avisa.
 */
async function rankingNacional(
  codigoCargo: string,
  boletinsUf: (Boletim | null)[],
): Promise<Mapa["nacional"]> {
  const oficial = await obterResultado({ cargo: codigoCargo, uf: null, mu: null });
  if (oficial.ok) {
    return oficial.dados.candidatos.map((c) => ({ ...resumir(c)!, fonte: "brasil" as const }));
  }

  const porCandidato = new Map<string, ResumoCandidato>();
  for (const b of boletinsUf) {
    for (const c of b?.candidatos ?? []) {
      const atual = porCandidato.get(c.sqcand);
      if (atual) atual.votos += c.votos;
      else porCandidato.set(c.sqcand, { ...resumir(c)!, pct: 0 });
    }
  }
  const soma = [...porCandidato.values()].reduce((s, c) => s + c.votos, 0);
  return [...porCandidato.values()]
    .map((c) => ({ ...c, pct: soma > 0 ? (c.votos / soma) * 100 : 0, fonte: "soma-ufs" as const }))
    .sort((a, b) => b.votos - a.votos || a.numero.localeCompare(b.numero, undefined, { numeric: true }));
}

const resumir = (c: ResumoCandidato | undefined): ResumoCandidato | null =>
  c
    ? { sqcand: c.sqcand, nomeUrna: c.nomeUrna, partido: c.partido, numero: c.numero, votos: c.votos, pct: c.pct }
    : null;

/**
 * Dispara as 27 UFs em paralelo e devolve só o resumo de cada uma — poucos KB em
 * vez de 27 boletins completos. São 27 requisições a cada 30s contra um limite de
 * 2000/s: irrelevante. Uma UF que falhe volta como indisponível em vez de
 * derrubar o mapa inteiro.
 *
 * Sobre `agregavel`: só Presidente tem os mesmos candidatos nas 27 UFs, então só
 * nele faz sentido pintar o mapa por líder — aí a cor significa a mesma pessoa em
 * todo lugar. Para Governador, Senador e deputados o "líder" é uma pessoa
 * diferente em cada estado, e pintar por identidade não comunicaria nada: o mapa
 * cai para a rampa de % apurado e o nome do líder fica no tooltip.
 */
export async function obterMapa(codigoCargo: string): Promise<Resultado<Mapa>> {
  // O cargo precisa existir no nível UF em pelo menos um estado. Sondar uma UF
  // fixa falharia para Dep. Distrital, que só existe no DF.
  const sonda =
    UFS.map((u) => validarRecorte(codigoCargo, u.sigla, null)).find((r) => r.ok) ??
    validarRecorte(codigoCargo, "sp", null);
  if (!sonda.ok) {
    return {
      ok: false,
      status: 400,
      erro: `Este cargo não é publicado por estado, então não há mapa. ${sonda.erro}`,
    };
  }

  const resultados = await Promise.allSettled(
    UFS.map(async (uf) => {
      const recorte = validarRecorte(codigoCargo, uf.sigla, null);
      // UF que não elege este cargo (Dep. Estadual no DF, por exemplo).
      if (!recorte.ok) return null;
      const url = urlResultado({ cargo: recorte.cargo, nivel: "uf", uf: uf.sigla });
      const bruto = await buscarTse<RawBoletim>(url, REVALIDATE.resultado);
      return normalizarBoletim(bruto, recorte.cargo, uf.sigla);
    }),
  );

  const boletins = resultados.map((r) => (r.status === "fulfilled" ? r.value : null));

  const estados: ResumoUf[] = boletins.map((b, i) => {
    const uf = UFS[i];
    const elegivel = validarRecorte(codigoCargo, uf.sigla, null).ok;
    const base = { uf: uf.sigla, nome: uf.nome, ibge: uf.ibge, elegivel };
    if (!b) {
      return {
        ...base, disponivel: false, pctApurado: 0, secoesApuradas: 0, secoesTotal: 0,
        eleitorado: 0, comparecimento: 0, pctAbstencao: 0, lider: null, segundo: null, margem: null,
      };
    }
    const lider = resumir(b.candidatos[0]);
    const segundo = resumir(b.candidatos[1]);
    const temVoto = !!lider && lider.votos > 0;
    return {
      ...base,
      disponivel: true,
      pctApurado: b.secoes.pctApuradas,
      secoesApuradas: b.secoes.apuradas,
      secoesTotal: b.secoes.total,
      eleitorado: b.eleitorado.aptos,
      comparecimento: b.eleitorado.comparecimento,
      pctAbstencao: b.eleitorado.pctAbstencao,
      // Com tudo zerado não existe líder: melhor null do que "eleger" o primeiro
      // da ordem de desempate por acidente.
      lider: temVoto ? lider : null,
      segundo: temVoto && segundo && segundo.votos > 0 ? segundo : null,
      margem: temVoto && segundo ? lider!.pct - segundo.pct : null,
    };
  });

  const agregavel = sonda.cargo.codigo === "1";
  const nacional = agregavel ? await rankingNacional(sonda.cargo.codigo, boletins) : [];

  return {
    ok: true,
    dados: {
      cargo: { codigo: sonda.cargo.codigo, nome: sonda.cargo.nome },
      agregavel,
      nacional,
      estados,
      // Só conta como indisponível a UF que deveria ter o cargo e falhou.
      indisponiveis: estados.filter((e) => e.elegivel && !e.disponivel).map((e) => e.uf),
    },
  };
}
