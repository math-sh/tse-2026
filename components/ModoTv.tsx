"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { INTERVALO_MS, consultaMapa, consultaResultado, useAgora, useTamanho } from "@/lib/cliente";
import { ajustarFiltros, filtrosParaQuery, lerFiltros, precisaDeUf, type FiltrosUrl } from "@/lib/filtros";
import { ROTULO_TURNO, cargoPorCodigo } from "@/lib/tse/cargos";
import { fmtInt, fmtPct } from "@/lib/tse/parse";
import { ufPorSigla } from "@/lib/tse/ufs";
import { BarrasCandidatos } from "@/components/charts/BarrasCandidatos";
import { MapaBrasil } from "@/components/charts/MapaBrasil";

/** Rotação padrão: Presidente no país e os seis governos com 2º turno. */
const GOVERNOS = cargoPorCodigo("3")?.ufsComDisputa ?? [];
const ROTACAO_PADRAO = ["1", ...GOVERNOS.map((uf) => `3:${uf}`)];
const INTERVALO_PADRAO_S = 20;

/** "3:sp" → { cargo: "3", uf: "sp", mu: null }. Visão inválida é descartada. */
function lerVisao(token: string): FiltrosUrl | null {
  const [cargo, uf, mu] = token.trim().toLowerCase().split(":");
  if (!cargo || !cargoPorCodigo(cargo)) return null;
  const f = ajustarFiltros({ cargo: "1", uf: null, mu: null }, { cargo, uf: uf || null, mu: mu || null });
  // Se a cascata teve de trocar o cargo, a visão pedida não existe.
  if (f.cargo !== cargo || precisaDeUf(f)) return null;
  return f;
}

const descrever = (f: FiltrosUrl) => {
  const cargo = cargoPorCodigo(f.cargo)?.nome ?? "";
  const lugar = f.mu ? `Município ${f.mu}` : f.uf ? ufPorSigla(f.uf)?.nome ?? f.uf.toUpperCase() : "Brasil";
  return { cargo, lugar };
};

/**
 * Modo telão: sem controles visíveis, tipografia grande, rotação automática.
 *
 * Configurável pela URL:
 *   /tv?visoes=1,3:sp,5:mg&intervalo=15
 * Teclado: ← → trocam de visão, espaço pausa, F alterna tela cheia.
 */
export function ModoTv() {
  const params = useSearchParams();
  const queryClient = useQueryClient();

  const visoes = useMemo(() => {
    const pedidas = params.get("visoes")?.split(",").map(lerVisao).filter((v): v is FiltrosUrl => !!v);
    const lista = pedidas?.length ? pedidas : ROTACAO_PADRAO.map(lerVisao).filter((v): v is FiltrosUrl => !!v);
    // Vindo do dashboard (/tv?cargo=3&uf=sp), o recorte de origem abre a rotação.
    if (!params.get("visoes") && (params.get("cargo") || params.get("uf"))) {
      const origem = lerFiltros(params);
      if (!precisaDeUf(origem)) {
        const chave = filtrosParaQuery(origem);
        return [origem, ...lista.filter((v) => filtrosParaQuery(v) !== chave)];
      }
    }
    return lista;
  }, [params]);

  const intervalo = Math.max(8, Number(params.get("intervalo")) || INTERVALO_PADRAO_S) * 1000;

  const [indice, setIndice] = useState(0);
  const [inicioVisao, setInicioVisao] = useState(() => Date.now());
  const [pausado, setPausado] = useState(false);
  const [dicaVisivel, setDicaVisivel] = useState(true);
  const [alturaTela, setAlturaTela] = useState(1080);
  const [refQuadro, quadro] = useTamanho<HTMLDivElement>();
  const agora = useAgora(250);

  // O telão tem de caber numa tela só: o mapa ganha a altura que sobra depois
  // de cabeçalho, rodapé e legenda.
  useEffect(() => {
    const medir = () => setAlturaTela(window.innerHeight);
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  const visao = visoes[indice % visoes.length];
  const proxima = visoes[(indice + 1) % visoes.length];

  const irPara = useCallback(
    (passo: number) => {
      setIndice((i) => (i + passo + visoes.length) % visoes.length);
      setInicioVisao(Date.now());
    },
    [visoes.length],
  );

  // Rotação.
  useEffect(() => {
    if (pausado || visoes.length < 2) return;
    if (agora - inicioVisao >= intervalo) irPara(1);
  }, [agora, inicioVisao, intervalo, irPara, pausado, visoes.length]);

  // Pré-carrega a próxima visão para a troca não mostrar "carregando".
  useEffect(() => {
    if (!proxima) return;
    void queryClient.prefetchQuery({ ...consultaResultado(proxima), staleTime: 25_000 });
    if (!proxima.uf) void queryClient.prefetchQuery({ ...consultaMapa(proxima.cargo), staleTime: 25_000 });
  }, [proxima, queryClient]);

  // Teclado.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") irPara(1);
      else if (e.key === "ArrowLeft") irPara(-1);
      else if (e.key === " ") {
        e.preventDefault();
        setPausado((p) => !p);
      } else if (e.key === "f" || e.key === "F") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.();
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [irPara]);

  useEffect(() => {
    const t = setTimeout(() => setDicaVisivel(false), 6000);
    return () => clearTimeout(t);
  }, []);

  const resultado = useQuery({
    ...consultaResultado(visao),
    refetchInterval: INTERVALO_MS,
    staleTime: 25_000,
  });
  const comMapa = !visao.uf;
  const mapa = useQuery({
    ...consultaMapa(visao.cargo),
    enabled: comMapa,
    refetchInterval: INTERVALO_MS,
    staleTime: 25_000,
  });

  const boletim = resultado.data;
  const { cargo, lugar } = descrever(visao);

  // Quantas linhas cabem no quadro, medido de verdade. Em telas baixas (720p) a
  // tipografia encolhe antes de cortar candidatos. A última vaga é do "Outros",
  // e ~40px ficam para a nota dos 50% (que só aparece no tamanho normal).
  const maximo = boletim?.cargo.proporcional ? 6 : 5;
  const linhasGrandes = quadro.altura >= 85 * (maximo + 1);
  const alturaLinha = linhasGrandes ? 85 : 58;
  const util = quadro.altura - (linhasGrandes ? 0 : 40);
  const limite = quadro.altura
    ? Math.max(2, Math.min(maximo, Math.floor(util / alturaLinha) - 1))
    : maximo;
  const progresso = pausado ? 0 : Math.min(1, (agora - inicioVisao) / intervalo);

  return (
    <div className="flex h-dvh flex-col gap-6 overflow-hidden px-6 py-6 lg:px-12 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[18px] font-medium text-ink-2">Eleições 2026 · {ROTULO_TURNO}</p>
          <h1 className="mt-1 text-[clamp(36px,4.5vw,64px)] font-semibold leading-none tracking-tight text-ink">
            {cargo} <span className="text-ink-2">· {lugar}</span>
          </h1>
        </div>
        {boletim && (
          <div className="text-right">
            <p className="text-[clamp(48px,6vw,96px)] font-semibold leading-none tracking-tight text-ink">
              {fmtPct(boletim.secoes.pctApuradas)}
            </p>
            <p className="tabular mt-1 text-[18px] text-ink-2">
              das urnas apuradas · {fmtInt(boletim.secoes.apuradas)} de {fmtInt(boletim.secoes.total)}
            </p>
          </div>
        )}
      </header>

      <main className={`grid min-h-0 flex-1 gap-8 ${comMapa ? "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" : ""}`}>
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-hairline bg-surface-1 p-6 lg:p-8">
          <div ref={refQuadro} className="min-h-0 flex-1">
            {boletim ? (
              <BarrasCandidatos boletim={boletim} limite={limite} grande={linhasGrandes} />
            ) : resultado.isError ? (
              <p className="text-[22px] text-ink-2">{resultado.error.message}</p>
            ) : (
              <p className="text-[22px] text-ink-2">Carregando {cargo} · {lugar}…</p>
            )}
          </div>
        </section>

        {comMapa && (
          <section className="min-h-0 min-w-0 overflow-hidden rounded-2xl border border-hairline bg-surface-1 p-6">
            {mapa.data ? (
              <MapaBrasil
                mapa={mapa.data}
                ufSelecionada={null}
                aoSelecionar={() => {}}
                compacto
                // cabeçalho + rodapé + respiros ≈ 330px; legenda + padding ≈ 170px
                alturaMaxima={Math.max(240, alturaTela - 500)}
              />
            ) : (
              <div className="aspect-square animate-pulse rounded-xl bg-surface-2" />
            )}
          </section>
        )}
      </main>

      <footer className="flex flex-col gap-3">
        {visoes.length > 1 && (
          <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--grid)" }}>
            <div className="h-full rounded-full" style={{ width: `${progresso * 100}%`, background: "var(--seq-500)" }} />
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 text-[15px] text-ink-2">
          <span>
            {boletim?.geradoEm &&
              `Boletim do TSE das ${new Date(boletim.geradoEm).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })} · `}
            Fonte: resultados.tse.jus.br
          </span>
          {visoes.length > 1 && (
            <span className="tabular">
              {pausado ? "Pausado" : `A seguir: ${descrever(proxima).cargo} · ${descrever(proxima).lugar}`} ·{" "}
              {(indice % visoes.length) + 1}/{visoes.length}
            </span>
          )}
        </div>
        <p
          className={`text-[13px] text-ink-muted transition-opacity duration-1000 ${dicaVisivel ? "opacity-100" : "opacity-0"}`}
          aria-hidden={!dicaVisivel}
        >
          ← → trocam de visão · espaço pausa · F tela cheia ·{" "}
          <Link href={`/${filtrosParaQuery(visao)}`} className="underline">
            voltar ao painel
          </Link>
        </p>
      </footer>
    </div>
  );
}
