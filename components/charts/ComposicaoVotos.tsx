"use client";

import { useState } from "react";
import type { Boletim } from "@/lib/tse/normalize";
import { fmtInt, fmtPct } from "@/lib/tse/parse";
import { VOTO_BRANCO, VOTO_NULO, VOTO_VALIDO, VOTO_VALIDO_2 } from "@/lib/viz/palette";
import { Dica, Vazio, type EstadoDica } from "@/components/ui";

interface Segmento {
  chave: string;
  rotulo: string;
  valor: number;
  cor: string;
}

/**
 * Parte-de-todo dos votos: barra empilhada 100%.
 *
 * As cores são semânticas: válidos em verde, brancos em branco e nulos em
 * amarelo. Nos cargos proporcionais os válidos se dividem em nominais (verde
 * escuro) e de legenda (verde claro) — e a legenda conta para as cadeiras do
 * partido, então vale mostrar. Nos majoritários não existe voto de legenda, e a
 * barra fica em três segmentos.
 *
 * Comparecimento × abstenção NÃO entra aqui: seria uma barra de duas fatias
 * repetindo o que os stat tiles do topo já dizem com o número.
 */
export function ComposicaoVotos({ boletim }: { boletim: Boletim }) {
  const [dica, setDica] = useState<EstadoDica | null>(null);
  const v = boletim.votos;

  if (boletim.secoes.apuradas === 0 || v.total === 0) {
    return (
      <Vazio>
        A composição dos votos aparece quando o TSE publicar o primeiro boletim com urnas apuradas.
      </Vazio>
    );
  }

  const segmentos: Segmento[] =
    boletim.cargo.proporcional && v.legenda > 0
      ? [
          { chave: "nominais", rotulo: "Nominais", valor: v.nominais, cor: VOTO_VALIDO },
          { chave: "legenda", rotulo: "Legenda", valor: v.legenda, cor: VOTO_VALIDO_2 },
          { chave: "brancos", rotulo: "Brancos", valor: v.brancos, cor: VOTO_BRANCO },
          { chave: "nulos", rotulo: "Nulos", valor: v.nulos, cor: VOTO_NULO },
        ]
      : [
          { chave: "validos", rotulo: "Válidos", valor: v.validos, cor: VOTO_VALIDO },
          { chave: "brancos", rotulo: "Brancos", valor: v.brancos, cor: VOTO_BRANCO },
          { chave: "nulos", rotulo: "Nulos", valor: v.nulos, cor: VOTO_NULO },
        ];

  const total = segmentos.reduce((s, x) => s + x.valor, 0);
  const pct = (x: number) => (total > 0 ? (x / total) * 100 : 0);

  return (
    <div>
      {/* Legenda sempre presente, com o valor como rótulo direto; texto em tinta
          de texto, a cor fica só na amostra. */}
      <ul className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {segmentos.map((s) => (
          <li key={s.chave} className="min-w-0">
            <div className="flex items-center gap-1.5 text-[13px] text-ink-2">
              <span aria-hidden className="size-2.5 shrink-0 rounded-sm ring-1 ring-hairline" style={{ background: s.cor }} />
              {s.rotulo}
            </div>
            <div className="mt-0.5 text-[20px] font-semibold text-ink">{fmtPct(pct(s.valor))}</div>
            <div className="tabular text-[12px] text-ink-muted">{fmtInt(s.valor)}</div>
          </li>
        ))}
      </ul>

      <div
        className="flex h-6 w-full overflow-hidden rounded"
        // 2px de superfície entre preenchimentos adjacentes.
        style={{ gap: 2, background: "var(--surface-1)" }}
        onPointerLeave={() => setDica(null)}
        role="img"
        aria-label={segmentos.map((s) => `${s.rotulo} ${fmtPct(pct(s.valor))}`).join(", ")}
      >
        {segmentos
          .filter((s) => s.valor > 0)
          .map((s) => (
            <div
              key={s.chave}
              className="marca h-full transition-[flex-grow] duration-700 ease-out"
              style={{
                flexGrow: s.valor,
                flexBasis: 0,
                background: s.cor,
                minWidth: 2,
                // O segmento branco precisa de contorno para não sumir na superfície clara.
                boxShadow: s.chave === "brancos" ? "inset 0 0 0 1px var(--baseline)" : undefined,
              }}
              onPointerMove={(ev) =>
                setDica({
                  x: ev.clientX,
                  y: ev.clientY,
                  conteudo: (
                    <div className="tabular flex justify-between gap-3">
                      <span>{s.rotulo}</span>
                      <span>
                        {fmtInt(s.valor)} · <b>{fmtPct(pct(s.valor))}</b>
                      </span>
                    </div>
                  ),
                })
              }
            />
          ))}
      </div>

      <p className="mt-3 text-[12px] text-ink-muted">
        Sobre o total de {fmtInt(total)} votos apurados.
        {boletim.cargo.proporcional && " Votos de legenda contam para as cadeiras do partido."}
      </p>
      <Dica dica={dica} />
    </div>
  );
}
