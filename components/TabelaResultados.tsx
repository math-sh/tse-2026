"use client";

import { useDeferredValue, useMemo, useState } from "react";
import type { Boletim, Candidato } from "@/lib/tse/normalize";
import { fmtInt, fmtPct } from "@/lib/tse/parse";
import { BotaoSecundario, ChipPartido, Segmentado } from "@/components/ui";

const ALTURA_LINHA = 44;
const ALTURA_JANELA = 440;
const SOBRA = 8;

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Tabela completa — a rota acessível de todos os gráficos, e a única que mostra
 * TODOS os candidatos (os gráficos dobram a cauda em "Outros").
 *
 * Virtualizada à mão: são até 1045 linhas (Dep. Federal em SP), e renderizar
 * todas a cada polling de 30s travaria a rolagem. Só as linhas visíveis (mais
 * uma sobra) existem no DOM.
 */
export function TabelaResultados({ boletim, rotuloAbrangencia }: { boletim: Boletim; rotuloAbrangencia: string }) {
  const [busca, setBusca] = useState("");
  const [rolagem, setRolagem] = useState(0);
  const [visao, setVisao] = useState<"candidatos" | "partidos">("candidatos");
  const buscaAdiada = useDeferredValue(busca);

  const posicao = useMemo(
    () => new Map(boletim.candidatos.map((c, i) => [c.sqcand, i + 1])),
    [boletim.candidatos],
  );

  const filtrados = useMemo(() => {
    const termo = semAcento(buscaAdiada.trim());
    if (!termo) return boletim.candidatos;
    return boletim.candidatos.filter((c) =>
      semAcento(`${c.nomeUrna} ${c.nome} ${c.numero} ${c.partido} ${c.federacao ?? ""}`).includes(termo),
    );
  }, [boletim.candidatos, buscaAdiada]);

  const inicio = Math.max(0, Math.floor(rolagem / ALTURA_LINHA) - SOBRA);
  const fim = Math.min(filtrados.length, Math.ceil((rolagem + ALTURA_JANELA) / ALTURA_LINHA) + SOBRA);
  const visiveis = filtrados.slice(inicio, fim);

  const exportar = () => baixarCsv(boletim, rotuloAbrangencia);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {boletim.cargo.proporcional && (
          <Segmentado
            rotulo="Mostrar"
            valor={visao}
            aoMudar={setVisao}
            opcoes={[
              { valor: "candidatos", rotulo: "Candidatos" },
              { valor: "partidos", rotulo: "Partidos" },
            ]}
          />
        )}
        {visao === "candidatos" && (
          <label className="relative min-w-48 flex-1">
            <span className="sr-only">Buscar candidato</span>
            <input
              type="search"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setRolagem(0);
              }}
              placeholder="Buscar por nome, número ou partido"
              className="h-8 w-full rounded-md border border-hairline bg-surface-1 px-3 text-[13px] text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--seq-500)]"
            />
          </label>
        )}
        <BotaoSecundario onClick={exportar} className="ml-auto">
          <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Exportar CSV
        </BotaoSecundario>
      </div>

      {visao === "partidos" ? (
        <TabelaPartidos boletim={boletim} />
      ) : (
        <>
          <p className="text-[12px] text-ink-muted" aria-live="polite">
            {filtrados.length === boletim.candidatos.length
              ? `${fmtInt(filtrados.length)} candidatos`
              : `${fmtInt(filtrados.length)} de ${fmtInt(boletim.candidatos.length)} candidatos`}
            {boletim.cargo.vagas > 1 && ` · ${boletim.cargo.vagas} vagas`}
          </p>

          <div
            className="overflow-auto rounded-lg border border-hairline"
            style={{ height: Math.min(ALTURA_JANELA, ALTURA_LINHA * (filtrados.length + 1) + 2) }}
            onScroll={(e) => setRolagem(e.currentTarget.scrollTop)}
          >
            <table className="w-full min-w-[640px] border-collapse text-[13px]" aria-rowcount={filtrados.length + 1}>
              <caption className="sr-only">
                Resultado de {boletim.cargo.nome} — {rotuloAbrangencia}
              </caption>
              <thead className="sticky top-0 z-10 bg-surface-1 text-left text-ink-2 shadow-[0_1px_0_var(--border)]">
                <tr style={{ height: ALTURA_LINHA }}>
                  <th scope="col" className="w-12 px-3 text-right font-medium">#</th>
                  <th scope="col" className="px-3 font-medium">Candidato</th>
                  <th scope="col" className="px-3 font-medium">Partido</th>
                  <th scope="col" className="px-3 text-right font-medium">Votos</th>
                  <th scope="col" className="px-3 text-right font-medium">%</th>
                  <th scope="col" className="px-3 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {inicio > 0 && <tr aria-hidden style={{ height: inicio * ALTURA_LINHA }} />}
                {visiveis.map((c, i) => (
                  <Linha key={c.sqcand} c={c} posicao={posicao.get(c.sqcand) ?? 0} indice={inicio + i + 2} />
                ))}
                {fim < filtrados.length && (
                  <tr aria-hidden style={{ height: (filtrados.length - fim) * ALTURA_LINHA }} />
                )}
              </tbody>
            </table>
            {filtrados.length === 0 && (
              <p className="px-3 py-6 text-center text-[13px] text-ink-2">Nenhum candidato encontrado para “{busca}”.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Linha({ c, posicao, indice }: { c: Candidato; posicao: number; indice: number }) {
  return (
    <tr aria-rowindex={indice} className="border-t border-hairline hover:bg-surface-2" style={{ height: ALTURA_LINHA }}>
      <td className="px-3 text-right text-ink-muted">{posicao}º</td>
      <th scope="row" className="max-w-0 px-3 text-left font-normal">
        <div className="truncate font-medium text-ink" title={c.nome}>{c.nomeUrna}</div>
        <div className="truncate text-[11px] text-ink-muted">{c.nome}</div>
      </th>
      <td className="px-3">
        <ChipPartido sigla={c.partido} numero={c.numero} />
      </td>
      <td className="px-3 text-right">{fmtInt(c.votos)}</td>
      <td className="px-3 text-right font-semibold">{fmtPct(c.pct)}</td>
      <td className="px-3 text-ink-2">
        {c.eleito ? (
          <span className="inline-flex items-center gap-1 font-medium" style={{ color: "var(--delta-up)" }}>
            <svg aria-hidden width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {c.situacao || "Eleito"}
          </span>
        ) : (
          c.situacao || <span className="text-ink-muted">—</span>
        )}
      </td>
    </tr>
  );
}

/** Nos cargos proporcionais, as cadeiras são por partido: nominais + legenda. */
function TabelaPartidos({ boletim }: { boletim: Boletim }) {
  const total = boletim.partidos.reduce((s, p) => s + p.votosTotais, 0);
  return (
    <div className="max-h-[440px] overflow-auto rounded-lg border border-hairline">
      <table className="w-full min-w-[560px] text-[13px]">
        <caption className="sr-only">Votos por partido — {boletim.cargo.nome}</caption>
        <thead className="sticky top-0 bg-surface-1 text-left text-ink-2 shadow-[0_1px_0_var(--border)]">
          <tr className="h-11">
            <th scope="col" className="px-3 font-medium">Partido</th>
            <th scope="col" className="px-3 text-right font-medium">Nominais</th>
            <th scope="col" className="px-3 text-right font-medium">Legenda</th>
            <th scope="col" className="px-3 text-right font-medium">Total</th>
            <th scope="col" className="px-3 text-right font-medium">%</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {boletim.partidos.map((p) => (
            <tr key={p.sigla} className="h-10 border-t border-hairline hover:bg-surface-2">
              <th scope="row" className="px-3 text-left font-normal">
                <ChipPartido sigla={p.sigla} />
                {p.federacao && <span className="ml-2 text-[11px] text-ink-muted">{p.federacao}</span>}
              </th>
              <td className="px-3 text-right">{fmtInt(p.votosNominais)}</td>
              <td className="px-3 text-right">{fmtInt(p.votosLegenda)}</td>
              <td className="px-3 text-right font-semibold">{fmtInt(p.votosTotais)}</td>
              <td className="px-3 text-right">{fmtPct(total > 0 ? (p.votosTotais / total) * 100 : 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * CSV no formato que o Excel em pt-BR abre direto: separador `;`, decimal com
 * vírgula e BOM UTF-8 (sem ele o Excel embaralha os acentos).
 */
function baixarCsv(b: Boletim, abrangencia: string) {
  const campo = (v: string | number) => {
    const s = String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const pct = (n: number) => n.toFixed(2).replace(".", ",");

  const linhas = [
    ["posicao", "numero", "nome_urna", "nome", "partido", "federacao", "coligacao", "votos", "percentual", "eleito", "situacao"],
    ...b.candidatos.map((c, i) => [
      i + 1, c.numero, c.nomeUrna, c.nome, c.partido, c.federacao ?? "", c.coligacao ?? "", c.votos, pct(c.pct),
      c.eleito ? "sim" : "nao", c.situacao,
    ]),
  ];
  const csv = "﻿" + linhas.map((l) => l.map(campo).join(";")).join("\r\n");

  const carimbo = (b.geradoEm ?? new Date().toISOString()).slice(0, 16).replace(/[-:T]/g, "");
  const nome = `apuracao-2026-${semAcento(b.cargo.nome).replace(/\s+/g, "-")}-${semAcento(abrangencia).replace(/[^a-z0-9]+/g, "-")}-${carimbo}.csv`;

  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
