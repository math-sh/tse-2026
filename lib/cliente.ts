"use client";

/**
 * Hooks de dados do lado do cliente.
 *
 * O polling é de 30s, alinhado ao `max-age=50` do TSE e ao `revalidate: 30` do
 * servidor — pollar mais rápido não traz boletim novo. Aba oculta não polla.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ajustarFiltros,
  chaveFiltros,
  filtrosParaQuery,
  lerFiltros,
  precisaDeUf,
  type FiltrosUrl,
} from "@/lib/filtros";
import type { Boletim, Municipio } from "@/lib/tse/normalize";
import type { Mapa } from "@/lib/tse/tipos-mapa";

export const INTERVALO_MS = 30_000;

async function buscarJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  const corpo = await r.json().catch(() => null);
  if (!r.ok) {
    throw new Error((corpo as { erro?: string } | null)?.erro ?? `Erro ${r.status} ao consultar ${url}`);
  }
  return corpo as T;
}

/* ----------------------------------------------------------- filtros na URL */

export function useFiltros() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filtros = useMemo(() => lerFiltros(params), [params]);

  const definir = useCallback(
    (mudanca: Partial<FiltrosUrl>) => {
      const novo = ajustarFiltros(filtros, mudanca);
      // replace, não push: trocar filtro não deve encher o histórico do botão voltar.
      router.replace(`${pathname}${filtrosParaQuery(novo)}`, { scroll: false });
    },
    [filtros, pathname, router],
  );

  return { filtros, definir };
}

/* ------------------------------------------------------------------- dados */

export interface Inicial {
  filtros: FiltrosUrl;
  boletim: Boletim | null;
  mapa: Mapa | null;
}

/** Chave + função da consulta de resultado — compartilhada com o prefetch do modo TV. */
export const consultaResultado = (f: FiltrosUrl) => ({
  queryKey: ["resultado", f.cargo, f.uf, f.mu] as const,
  queryFn: () => {
    const p = new URLSearchParams({ cargo: f.cargo });
    if (f.uf) p.set("uf", f.uf);
    if (f.mu) p.set("mu", f.mu);
    return buscarJson<Boletim>(`/api/tse/resultado?${p}`);
  },
});

export const consultaMapa = (cargo: string) => ({
  queryKey: ["mapa", cargo] as const,
  queryFn: () => buscarJson<Mapa>(`/api/tse/mapa?cargo=${cargo}`),
});

export function useResultado(filtros: FiltrosUrl, inicial?: Inicial) {
  const habilitado = !precisaDeUf(filtros);
  const mesmoRecorte = !!inicial && chaveFiltros(inicial.filtros) === chaveFiltros(filtros);

  return useQuery({
    ...consultaResultado(filtros),
    enabled: habilitado,
    initialData: mesmoRecorte && inicial?.boletim ? inicial.boletim : undefined,
    // Marcado como já velho: o cache do servidor pode ter entregue um boletim
    // anterior (stale-while-revalidate), então o cliente confere logo ao montar.
    initialDataUpdatedAt: mesmoRecorte ? 0 : undefined,
    // Trocar de filtro mantém o boletim anterior na tela até o novo chegar,
    // em vez de piscar o dashboard inteiro para um esqueleto.
    placeholderData: keepPreviousData,
    refetchInterval: INTERVALO_MS,
    refetchIntervalInBackground: false,
    staleTime: 25_000,
    retry: (falhas, erro) => falhas < 2 && !/não publica|inválid/i.test(erro.message),
  });
}

export function useMapa(cargo: string, inicial?: Inicial) {
  const mesmo = !!inicial?.mapa && inicial.mapa.cargo.codigo === cargo;
  return useQuery({
    ...consultaMapa(cargo),
    // Cons. Distrital só existe num município: não há mapa por estado.
    enabled: cargo !== "25",
    initialData: mesmo ? inicial!.mapa! : undefined,
    initialDataUpdatedAt: mesmo ? 0 : undefined,
    placeholderData: keepPreviousData,
    refetchInterval: INTERVALO_MS,
    refetchIntervalInBackground: false,
    staleTime: 25_000,
  });
}

export function useMunicipios(uf: string | null) {
  return useQuery({
    queryKey: ["municipios", uf],
    queryFn: () => buscarJson<{ municipios: Municipio[] }>(`/api/tse/municipios?uf=${uf}`),
    enabled: !!uf,
    staleTime: 60 * 60 * 1000,
    select: (d) => d.municipios,
  });
}

/* ---------------------------------------------------------- utilidades de UI */

/** Relógio que bate a cada `ms` — para o "atualizado há Xs". */
export function useAgora(ms = 1000): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return agora;
}

/**
 * Largura do contêiner, para SVGs responsivos.
 *
 * Callback ref em vez de useRef: o contêiner pode ser desmontado e recriado (o
 * mapa alterna com a tabela), e o observer precisa acompanhar o elemento novo.
 */
export function useLargura<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [ref, { largura }] = useTamanho<T>();
  return [ref, largura];
}

/** Largura e altura do conteúdo do elemento, acompanhando redimensionamentos. */
export function useTamanho<T extends HTMLElement>(): [
  (el: T | null) => void,
  { largura: number; altura: number },
] {
  const [tamanho, setTamanho] = useState({ largura: 0, altura: 0 });
  const observador = useRef<ResizeObserver | null>(null);

  const ref = useCallback((el: T | null) => {
    observador.current?.disconnect();
    observador.current = null;
    if (!el) return;
    // O ResizeObserver dispara uma vez ao começar a observar: não precisa medir à mão.
    const ro = new ResizeObserver(([entrada]) =>
      setTamanho({
        largura: Math.floor(entrada.contentRect.width),
        altura: Math.floor(entrada.contentRect.height),
      }),
    );
    ro.observe(el);
    observador.current = ro;
  }, []);

  useEffect(() => () => observador.current?.disconnect(), []);
  return [ref, tamanho];
}

/* ----------------------------------------------------- linha do tempo local */

export interface Snapshot {
  idg: string;
  geradoEm: string | null;
  pctApurado: number;
  /** sqcand → % de votos naquele boletim. */
  valores: Record<string, number>;
}

export interface Historico {
  nomes: Record<string, { nomeUrna: string; partido: string }>;
  pontos: Snapshot[];
}

const MAX_PONTOS = 400;
const VAZIO: Historico = { nomes: {}, pontos: [] };

function lerHistorico(chave: string): Historico {
  try {
    const bruto = localStorage.getItem(chave);
    if (!bruto) return VAZIO;
    const h = JSON.parse(bruto) as Historico;
    return Array.isArray(h?.pontos) ? h : VAZIO;
  } catch {
    // Janela privada, storage bloqueado ou cheio: segue sem histórico.
    return VAZIO;
  }
}

/**
 * Acumula boletins no navegador para desenhar a evolução da apuração.
 *
 * Deduplica pelo `idg` do TSE (o id de geração do boletim), então o mesmo
 * boletim visto por dois pollings vira um ponto só. Só grava a partir da
 * primeira urna apurada — antes disso todo ponto é zero e não diz nada.
 *
 * O histórico é DESTE navegador, desde que a página foi aberta: o componente
 * avisa isso para ninguém ler a linha como série oficial do TSE.
 */
export function useHistorico(filtros: FiltrosUrl, boletim: Boletim | undefined): Historico {
  const chave = `apuracao2026:${chaveFiltros(filtros)}`;
  const [historico, setHistorico] = useState<Historico>(VAZIO);

  useEffect(() => {
    setHistorico(lerHistorico(chave));
  }, [chave]);

  useEffect(() => {
    if (!boletim || boletim.secoes.apuradas === 0) return;
    // O boletim exibido pode ser o anterior (placeholder) enquanto o novo
    // recorte carrega: só grava quando ele pertence a este recorte.
    if (!boletimDoRecorte(boletim, filtros)) return;

    setHistorico((base) => {
      if (base.pontos.some((p) => p.idg === boletim.idGeracao)) return base;

      // Guarda os 8 primeiros de cada boletim: com 1045 candidatos a deputado,
      // guardar todos estouraria o localStorage em poucas horas.
      const topo = boletim.candidatos.slice(0, 8);
      const nomes = { ...base.nomes };
      for (const c of topo) nomes[c.sqcand] = { nomeUrna: c.nomeUrna, partido: c.partido };

      const ponto: Snapshot = {
        idg: boletim.idGeracao,
        geradoEm: boletim.geradoEm,
        pctApurado: boletim.secoes.pctApuradas,
        valores: Object.fromEntries(topo.map((c) => [c.sqcand, c.pct])),
      };

      const pontos = [...base.pontos, ponto]
        .sort((a, b) => a.pctApurado - b.pctApurado)
        .slice(-MAX_PONTOS);
      const novo = { nomes, pontos };
      try {
        localStorage.setItem(chave, JSON.stringify(novo));
      } catch {
        /* storage indisponível: mantém só em memória */
      }
      return novo;
    });
  }, [boletim, chave, filtros]);

  return historico;
}

/**
 * O boletim pertence ao recorte dos filtros? Com `keepPreviousData`, logo após
 * trocar um filtro o boletim na tela ainda é o do recorte anterior. `cdabr` do
 * TSE é "br", a sigla da UF ou o código do município, conforme o nível.
 */
export function boletimDoRecorte(b: Boletim, f: FiltrosUrl): boolean {
  const abrangencia = (f.mu ?? f.uf ?? "br").toLowerCase();
  return b.cargo.codigo === f.cargo && b.codigoAbrangencia.toLowerCase() === abrangencia;
}
