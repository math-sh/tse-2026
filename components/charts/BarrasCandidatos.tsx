"use client";

import { useState } from "react";
import type { Boletim } from "@/lib/tse/normalize";
import { fmtInt, fmtPct } from "@/lib/tse/parse";
import { dobrar, type Fatia } from "@/lib/viz/fold";
import { BARRA, DE_EMPHASIS } from "@/lib/viz/palette";
import { ChipPartido, Dica, Foto, type EstadoDica } from "@/components/ui";

/** Presidente e Governador: disputa majoritária, onde os 50% são referência. */
const CARGOS_MAJORITARIOS = new Set(["1", "3"]);

/** Arredonda o máximo do eixo para um número "redondo". */
function tetoBonito(max: number): number {
  if (max <= 0) return 10;
  const passo = max > 20 ? 10 : 5;
  return Math.min(100, Math.ceil((max * 1.08) / passo) * passo);
}

/**
 * Ranking horizontal (nomes longos pedem barra deitada).
 *
 * Um matiz só nas barras: a posição muda a cada boletim, e cor por colocação
 * faria os candidatos trocarem de cor numa ultrapassagem. A identidade vem do
 * rótulo direto e do chip partidário. "Outros" fica no cinza de retração.
 *
 * Escala: em Presidente e Governador o eixo vai de 0 a 100% para que a linha de
 * 50% dos válidos fique no lugar certo — no 1º turno ela indica a eleição
 * direta; no 2º, a maioria. Nos demais cargos ninguém chega perto de 50%, e o
 * eixo se ajusta ao maior valor.
 */
export function BarrasCandidatos({
  boletim,
  limite = 8,
  grande = false,
}: {
  boletim: Boletim;
  limite?: number;
  grande?: boolean;
}) {
  const [dica, setDica] = useState<EstadoDica | null>(null);
  const fatias = dobrar(boletim.candidatos, limite);
  const semVotos = boletim.votos.nominais === 0 && fatias.every((f) => f.votos === 0);

  const comLinha50 = CARGOS_MAJORITARIOS.has(boletim.cargo.codigo);
  const maxPct = Math.max(0, ...fatias.filter((f) => !f.ehOutros).map((f) => f.pct));
  const teto = comLinha50 ? 100 : tetoBonito(maxPct);
  const largura = (pct: number) => `${Math.max(0, Math.min(100, (pct / teto) * 100))}%`;

  const candidatos = boletim.candidatos;
  const detalhes = new Map(candidatos.map((c) => [c.sqcand, c]));

  const mostrar = (e: React.PointerEvent, f: Fatia) => {
    const c = detalhes.get(f.chave);
    setDica({
      x: e.clientX,
      y: e.clientY,
      conteudo: (
        <div className="space-y-1.5">
          <p className="font-semibold leading-snug">{c?.nome ?? f.rotulo}</p>
          {c && <p className="text-ink-2">{c.partidoNome}</p>}
          {c?.federacao && <p className="text-ink-2">Federação: {c.federacao}</p>}
          {c?.coligacao && <p className="text-ink-2">Coligação: {c.coligacao}</p>}
          {c?.vices.length ? (
            <p className="text-ink-2">
              {boletim.cargo.codigo === "5" ? "Suplentes" : "Vice"}: {c.vices.map((v) => `${v.nomeUrna} (${v.partido})`).join(", ")}
            </p>
          ) : null}
          {f.ehOutros && <p className="text-ink-2">Soma de {f.agrega} candidatos fora do topo.</p>}
          <div className="tabular flex justify-between border-t border-hairline pt-1.5">
            <span>{fmtInt(f.votos)} votos</span>
            <span className="font-semibold">{fmtPct(f.pct)}</span>
          </div>
        </div>
      ),
    });
  };

  const alturaBarra = grande ? 18 : 12;
  const foto = grande ? 56 : 36;

  return (
    <div className="relative">
      {semVotos && (
        <p className="mb-3 text-[13px] text-ink-2">
          Nenhum voto apurado ainda. Até o primeiro boletim, a ordem é pelo número do candidato.
        </p>
      )}

      <div className="relative" style={{ ["--col-valor" as string]: grande ? "150px" : "112px" }}>
        {/* Linha de referência dos 50% — atrás das barras, recessiva. A coluna
            da barra começa depois da foto + 1 gap e termina antes de 1 gap +
            a coluna de valor; os 50% ficam na metade desse trecho. */}
        {comLinha50 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0"
            style={{ left: `calc(${foto + 12}px + (100% - ${foto + 24}px - var(--col-valor)) * 0.5)` }}
          >
            <div className="h-full border-l border-dashed" style={{ borderColor: "var(--baseline)" }} />
          </div>
        )}

        <ol
          className={`flex flex-col ${grande ? "gap-5" : "gap-3.5"}`}
          onPointerLeave={() => setDica(null)}
        >
          {fatias.map((f, i) => (
            <li
              key={f.chave}
              className="grid items-center gap-x-3"
              style={{ gridTemplateColumns: `${foto}px minmax(0,1fr) var(--col-valor)` }}
              onPointerMove={(e) => mostrar(e, f)}
              onPointerLeave={() => setDica(null)}
              aria-label={`${i + 1}º ${f.rotulo}${f.partido ? `, ${f.partido}` : ""}: ${fmtPct(f.pct)}, ${fmtInt(f.votos)} votos`}
            >
              {f.ehOutros ? (
                <span
                  aria-hidden
                  style={{ width: foto, height: foto }}
                  className="inline-flex items-center justify-center rounded-full bg-surface-2 text-[11px] text-ink-muted ring-1 ring-hairline"
                >
                  +{f.agrega > 999 ? `${Math.floor(f.agrega / 1000)}k` : f.agrega}
                </span>
              ) : (
                <Foto url={f.fotoUrl} nome={f.rotulo} tamanho={foto} />
              )}

              <div className="min-w-0">
                <div className="mb-1.5 flex min-w-0 items-center gap-2">
                  <span className={`truncate font-medium text-ink ${grande ? "text-[22px]" : "text-[14px]"}`}>
                    {f.rotulo}
                  </span>
                  <ChipPartido sigla={f.partido} numero={f.numero} />
                  {f.eleito && <SeloEleito />}
                </div>
                <div className="relative w-full" style={{ height: alturaBarra }}>
                  <div
                    className="marca absolute inset-y-0 left-0 transition-[width] duration-700 ease-out"
                    style={{
                      width: largura(f.pct),
                      // Ponta de dado arredondada (4px), ancorada reta na base.
                      borderRadius: "0 4px 4px 0",
                      background: f.ehOutros ? DE_EMPHASIS : BARRA,
                      // Uma barra em zero ainda deixa um traço: "zero" e "sem barra" são coisas diferentes.
                      minWidth: 2,
                    }}
                  />
                </div>
              </div>

              <div className="text-right">
                <div className={`tabular font-semibold text-ink ${grande ? "text-[28px]" : "text-[16px]"}`}>
                  {fmtPct(f.pct)}
                </div>
                <div className={`tabular text-ink-muted ${grande ? "text-[15px]" : "text-[12px]"}`}>
                  {fmtInt(f.votos)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {comLinha50 && !grande && (
        <p className="mt-4 flex items-center gap-2 text-[12px] text-ink-muted">
          <span aria-hidden className="inline-block h-3 border-l border-dashed" style={{ borderColor: "var(--baseline)" }} />
          50% dos votos válidos{boletim.turno <= 1 ? " — abaixo disso, há 2º turno" : ""}
        </p>
      )}

      <Dica dica={dica} />
    </div>
  );
}

function SeloEleito() {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 text-[12px] font-medium" style={{ color: "var(--delta-up)" }}>
      <svg aria-hidden width="12" height="12" viewBox="0 0 16 16" fill="none">
        <path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Eleito
    </span>
  );
}
