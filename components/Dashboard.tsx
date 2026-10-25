"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  boletimDoRecorte,
  useFiltros,
  useHistorico,
  useMapa,
  useMunicipios,
  useResultado,
  type Inicial,
} from "@/lib/cliente";
import { filtrosParaQuery, precisaDeUf } from "@/lib/filtros";
import { DATA_TURNO, ROTULO_TURNO, cargoPorCodigo } from "@/lib/tse/cargos";
import { ufPorSigla } from "@/lib/tse/ufs";
import { MAX_SERIES_MAPA, estenderSlots, slotsEstaveis } from "@/lib/viz/palette";
import { StatusAtualizacao, TemaToggle } from "@/components/Cabecalho";
import { BarrasCandidatos } from "@/components/charts/BarrasCandidatos";
import { ComposicaoVotos } from "@/components/charts/ComposicaoVotos";
import { LinhaDoTempo } from "@/components/charts/LinhaDoTempo";
import { MapaBrasil } from "@/components/charts/MapaBrasil";
import { Filtros, titulo } from "@/components/filtros/Filtros";
import { HeroApuracao, KpiRow } from "@/components/kpi/Kpis";
import { TabelaResultados } from "@/components/TabelaResultados";
import { Cartao, Vazio } from "@/components/ui";

/** Quantas linhas a linha do tempo desenha. ≤ 5 mantém os rótulos diretos legíveis. */
const SERIES_LINHA = 5;

export function Dashboard({ inicial }: { inicial: Inicial }) {
  const { filtros, definir } = useFiltros();
  const resultado = useResultado(filtros, inicial);
  const mapa = useMapa(filtros.cargo, inicial);
  const municipios = useMunicipios(filtros.uf);

  const boletim = resultado.data;
  const historico = useHistorico(filtros, boletim);
  const cargo = cargoPorCodigo(filtros.cargo);
  const faltaUf = precisaDeUf(filtros);
  const trocando = !!boletim && !boletimDoRecorte(boletim, filtros);

  const nomeMunicipio = municipios.data?.find((m) => m.codigo === filtros.mu)?.nome;
  const uf = filtros.uf ? ufPorSigla(filtros.uf) : undefined;
  const abrangencia = filtros.mu
    ? `${nomeMunicipio ? titulo(nomeMunicipio) : `Município ${filtros.mu}`} (${filtros.uf?.toUpperCase()})`
    : uf?.nome ?? "Brasil";

  // Uma cor por pessoa, a mesma no mapa e na linha do tempo: os 3 primeiros do
  // país ficam com os slots do mapa, e a linha do tempo só estende.
  const cores = useMemo(() => {
    const destaques =
      mapa.data?.agregavel
        ? mapa.data.nacional.filter((c) => c.votos > 0).slice(0, MAX_SERIES_MAPA).map((c) => c.sqcand)
        : [];
    const base = slotsEstaveis(destaques, MAX_SERIES_MAPA);
    const ultimo = historico.pontos.at(-1);
    const serie = ultimo
      ? Object.entries(ultimo.valores).sort((a, b) => b[1] - a[1]).slice(0, SERIES_LINHA).map(([sq]) => sq)
      : [];
    return { mapa: base, linha: estenderSlots(base, serie), serie };
  }, [mapa.data, historico.pontos]);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-4 py-5 sm:px-6 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-ink-2">
            Eleições 2026 · {ROTULO_TURNO} · {DATA_TURNO}
          </p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]">
            Apuração em tempo real
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusAtualizacao
            geradoEm={boletim?.geradoEm ?? null}
            consultadoEm={resultado.dataUpdatedAt || mapa.dataUpdatedAt}
            buscando={resultado.isFetching || mapa.isFetching}
            erro={resultado.isError && boletim ? resultado.error.message : null}
            aoAtualizar={() => {
              void resultado.refetch();
              void mapa.refetch();
            }}
          />
          <Link
            href={`/tv${filtrosParaQuery(filtros)}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-surface-1 px-2.5 text-[13px] text-ink-2 hover:text-ink"
          >
            <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5.5 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Modo TV
          </Link>
          <TemaToggle />
        </div>
      </header>

      <Filtros filtros={filtros} definir={definir} />

      {faltaUf ? (
        <AvisoEscolhaUf nomeCargo={cargo?.nome ?? "Este cargo"} />
      ) : resultado.isError && !boletim ? (
        <Cartao titulo="Não foi possível carregar o resultado">
          <Vazio>
            <p className="font-medium text-ink">{resultado.error.message}</p>
            <p className="mt-1">O painel tenta de novo a cada 30 segundos.</p>
          </Vazio>
        </Cartao>
      ) : !boletim ? (
        <Esqueleto />
      ) : (
        <div className={`flex flex-col gap-5 transition-opacity ${trocando ? "opacity-60" : ""}`} aria-busy={trocando}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <div className="rounded-xl border border-hairline bg-surface-1 p-5">
              <HeroApuracao boletim={boletim} abrangencia={abrangencia} />
            </div>
            <KpiRow boletim={boletim} />
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <Cartao
              titulo={`${boletim.cargo.nome} · ${abrangencia}`}
              subtitulo={
                boletim.cargo.proporcional
                  ? `${boletim.cargo.vagas} vagas · os ${Math.min(8, boletim.candidatos.length)} mais votados; a tabela abaixo tem todos os ${boletim.candidatos.length}`
                  : boletim.cargo.vagas > 1
                    ? `${boletim.cargo.vagas} vagas · % dos votos válidos`
                    : "% dos votos válidos"
              }
            >
              <BarrasCandidatos boletim={boletim} />
            </Cartao>

            <Cartao titulo="Por estado" subtitulo="Clique num estado para filtrar">
              {mapa.data ? (
                <MapaBrasil
                  mapa={mapa.data}
                  ufSelecionada={filtros.uf}
                  aoSelecionar={(sigla) => definir({ uf: sigla })}
                />
              ) : mapa.isError ? (
                <Vazio>{mapa.error.message}</Vazio>
              ) : (
                <div className="aspect-square animate-pulse rounded-lg bg-surface-2" />
              )}
            </Cartao>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Cartao titulo="Evolução da apuração" subtitulo="% de votos conforme as urnas chegam">
              <LinhaDoTempo
                historico={historico}
                candidatos={cores.serie}
                cores={cores.linha}
                codigoCargo={filtros.cargo}
              />
            </Cartao>
            <Cartao titulo="Composição dos votos" subtitulo={abrangencia}>
              <ComposicaoVotos boletim={boletim} />
            </Cartao>
          </div>

          <Cartao titulo="Resultado completo" subtitulo={`${boletim.cargo.nome} · ${abrangencia}`}>
            <TabelaResultados boletim={boletim} rotuloAbrangencia={abrangencia} />
          </Cartao>
        </div>
      )}

      {/* Sem boletim (cargo estadual no nível Brasil), o mapa vira a navegação. */}
      {faltaUf && mapa.data && (
        <Cartao titulo={`${mapa.data.cargo.nome} por estado`} subtitulo="Clique num estado para ver o resultado">
          <div className="mx-auto max-w-xl">
            <MapaBrasil mapa={mapa.data} ufSelecionada={null} aoSelecionar={(sigla) => definir({ uf: sigla })} />
          </div>
        </Cartao>
      )}

      <footer className="border-t border-hairline pt-4 text-[12px] leading-relaxed text-ink-muted">
        Dados oficiais de divulgação do Tribunal Superior Eleitoral, consultados em{" "}
        <a className="underline hover:text-ink" href="https://resultados.tse.jus.br" target="_blank" rel="noreferrer">
          resultados.tse.jus.br
        </a>{" "}
        a cada 30 segundos. Painel independente, sem vínculo com o TSE. Percentuais de candidatos
        são os publicados pelo TSE, sobre os votos válidos.
      </footer>
    </div>
  );
}

function AvisoEscolhaUf({ nomeCargo }: { nomeCargo: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-hairline bg-surface-1 p-5">
      <svg aria-hidden width="20" height="20" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0 text-ink-2">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 7v4M8 5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <div>
        <p className="font-medium text-ink">{nomeCargo} é eleito por estado.</p>
        <p className="mt-0.5 text-[14px] text-ink-2">
          O TSE não publica um total nacional para este cargo. Escolha um estado no filtro acima ou clique no mapa.
        </p>
      </div>
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="flex flex-col gap-5" aria-busy aria-label="Carregando resultado">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.6fr]">
        <div className="h-48 animate-pulse rounded-xl bg-surface-1" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-surface-1" />
          ))}
        </div>
      </div>
      <div className="h-96 animate-pulse rounded-xl bg-surface-1" />
    </div>
  );
}
