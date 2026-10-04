"use client";

import type { Boletim } from "@/lib/tse/normalize";
import { fmtCompacto, fmtInt, fmtPct } from "@/lib/tse/parse";

/**
 * O número que o dashboard lidera: % de seções apuradas.
 *
 * Em 0% ele mostra "0,00%", não "—": zero urnas apuradas é um fato, não uma
 * ausência de dado. Já os percentuais DERIVADOS das urnas (comparecimento,
 * abstenção) mostram "—" nesse estado, porque "0,00% de abstenção" afirmaria
 * algo falso.
 */
export function HeroApuracao({ boletim, abrangencia }: { boletim: Boletim; abrangencia: string }) {
  const { apuradas, total, pctApuradas } = boletim.secoes;
  const fracao = total > 0 ? apuradas / total : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
        <span>Urnas apuradas · {abrangencia}</span>
        <StatusApuracao apuradas={apuradas} total={total} />
      </div>

      <div className="flex items-baseline gap-3">
        <span className="text-[clamp(48px,7vw,72px)] font-semibold leading-none tracking-tight text-ink">
          {fmtPct(pctApuradas)}
        </span>
      </div>

      {/* Medidor: trilho e preenchimento da mesma rampa. */}
      <div
        role="meter"
        aria-label="Seções apuradas"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pctApuradas}
        aria-valuetext={`${fmtPct(pctApuradas)} — ${fmtInt(apuradas)} de ${fmtInt(total)} seções`}
        className="h-2.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--seq-100)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${Math.min(100, fracao * 100)}%`, background: "var(--seq-500)" }}
        />
      </div>

      <p className="tabular text-[13px] text-ink-2">
        {fmtInt(apuradas)} de {fmtInt(total)} seções
      </p>
    </div>
  );
}

/**
 * Situação da apuração. "Concluída" é o único estado que usa cor de status, e
 * sempre com ícone + texto — status nunca é comunicado só por cor.
 */
function StatusApuracao({ apuradas, total }: { apuradas: number; total: number }) {
  if (total > 0 && apuradas >= total) {
    return (
      <span className="inline-flex items-center gap-1 font-medium" style={{ color: "var(--delta-up)" }}>
        <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Apuração concluída
      </span>
    );
  }
  if (apuradas === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-ink-2">
        <span aria-hidden className="size-1.5 rounded-full bg-ink-muted" />
        Aguardando o primeiro boletim
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-ink">
      <span aria-hidden className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60" style={{ background: "var(--seq-400)" }} />
        <span className="relative inline-flex size-2 rounded-full" style={{ background: "var(--seq-500)" }} />
      </span>
      Apuração em andamento
    </span>
  );
}

function StatTile({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-hairline bg-surface-1 p-4">
      <p className="text-[13px] text-ink-2">{rotulo}</p>
      <p className="mt-1.5 truncate text-[26px] font-semibold leading-tight text-ink">{valor}</p>
      <p className="mt-1 text-[12px] leading-snug text-ink-muted">
        {detalhe}
      </p>
    </div>
  );
}

export function KpiRow({ boletim }: { boletim: Boletim }) {
  const { eleitorado: e, votos: v } = boletim;
  const semUrnas = boletim.secoes.apuradas === 0;
  const aguardando = "aguarda urnas apuradas";

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        rotulo="Eleitorado apto"
        valor={fmtInt(e.aptos)}
        detalhe="eleitores aptos a votar"
      />
      <StatTile
        rotulo="Comparecimento"
        valor={semUrnas ? "—" : fmtPct(e.pctComparecimento)}
        detalhe={semUrnas ? aguardando : `${fmtInt(e.comparecimento)} eleitores`}
      />
      <StatTile
        rotulo="Abstenção"
        valor={semUrnas ? "—" : fmtPct(e.pctAbstencao)}
        detalhe={semUrnas ? aguardando : `${fmtInt(e.abstencao)} eleitores`}
      />
      <StatTile
        rotulo="Brancos e nulos"
        valor={semUrnas ? "—" : fmtPct(v.pctBrancos + v.pctNulos)}
        detalhe={semUrnas ? aguardando : `${fmtCompacto(v.brancos)} brancos · ${fmtCompacto(v.nulos)} nulos`}
      />
    </div>
  );
}
