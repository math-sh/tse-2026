"use client";

import { scaleLinear } from "d3-scale";
import { curveMonotoneX, line } from "d3-shape";
import { useMemo, useState } from "react";
import { useLargura, type Historico } from "@/lib/cliente";
import { fmtPct } from "@/lib/tse/parse";
import { DE_EMPHASIS } from "@/lib/viz/palette";
import { BotaoSecundario, Dica, Vazio, type EstadoDica } from "@/components/ui";

const ALTURA = 280;
const M = { topo: 14, direita: 150, base: 34, esquerda: 44 };
const COM_SEGUNDO_TURNO = new Set(["1", "3"]);

interface Serie {
  sqcand: string;
  nome: string;
  partido: string;
  cor: string;
  pontos: { x: number; y: number; i: number }[];
}

/**
 * Evolução do % de votos conforme as urnas chegam.
 *
 * O eixo x é % de urnas apuradas, não o relógio: é monotônico, e é a pergunta
 * que se faz numa apuração ("com 60% apurado, como estava?"). Eixo y único — %
 * de votos. Crosshair + tooltip por padrão; rótulo direto na ponta de cada
 * linha, além da legenda, porque com 4+ séries o rótulo direto é obrigatório.
 */
export function LinhaDoTempo({
  historico,
  candidatos,
  cores,
  codigoCargo,
}: {
  historico: Historico;
  /** sqcands a desenhar, já na ordem do ranking atual. */
  candidatos: string[];
  cores: ReadonlyMap<string, string>;
  codigoCargo: string;
}) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [indice, setIndice] = useState<number | null>(null);
  const [dica, setDica] = useState<EstadoDica | null>(null);
  const [verTabela, setVerTabela] = useState(false);

  const { pontos, nomes } = historico;

  const series: Serie[] = useMemo(
    () =>
      candidatos
        .map((sq) => ({
          sqcand: sq,
          nome: nomes[sq]?.nomeUrna ?? sq,
          partido: nomes[sq]?.partido ?? "",
          cor: cores.get(sq) ?? DE_EMPHASIS,
          pontos: pontos
            .map((p, i) => ({ x: p.pctApurado, y: p.valores[sq], i }))
            .filter((p): p is { x: number; y: number; i: number } => typeof p.y === "number"),
        }))
        .filter((s) => s.pontos.length > 0),
    [candidatos, nomes, pontos, cores],
  );

  if (pontos.length === 0 || series.length === 0) {
    return (
      <div ref={ref}>
        <Vazio>
          A linha começa a ser desenhada no primeiro boletim com urnas apuradas. Deixe esta página
          aberta: cada boletim novo do TSE vira um ponto.
        </Vazio>
      </div>
    );
  }

  const larguraPlot = Math.max(0, largura - M.esquerda - M.direita);
  const alturaPlot = ALTURA - M.topo - M.base;

  const xs = pontos.map((p) => p.pctApurado);
  const x0 = Math.floor(Math.min(...xs) / 10) * 10;
  const x1 = Math.max(x0 + 10, Math.ceil(Math.max(...xs) / 10) * 10);
  const x = scaleLinear().domain([x0, Math.min(100, x1)]).range([0, larguraPlot]);

  const ys = series.flatMap((s) => s.pontos.map((p) => p.y));
  const yMax = Math.max(...ys);
  const mostrar50 = COM_SEGUNDO_TURNO.has(codigoCargo) && yMax >= 40;
  const y = scaleLinear()
    .domain([0, Math.min(100, Math.max(mostrar50 ? 55 : 0, yMax * 1.12, 5))])
    .range([alturaPlot, 0])
    .nice(5);

  const gerador = line<{ x: number; y: number }>()
    .x((p) => x(p.x))
    .y((p) => y(p.y))
    .curve(curveMonotoneX);

  const rotulos = posicionarRotulos(
    series.map((s) => {
      const ultimo = s.pontos[s.pontos.length - 1];
      return { chave: s.sqcand, yAlvo: y(ultimo.y), texto: s.nome, valor: ultimo.y, cor: s.cor };
    }),
    alturaPlot,
  );

  const aoMover = (ev: React.PointerEvent<SVGRectElement>) => {
    const caixa = ev.currentTarget.getBoundingClientRect();
    const px = x.invert(ev.clientX - caixa.left);
    let melhor = 0;
    for (let i = 1; i < pontos.length; i++) {
      if (Math.abs(pontos[i].pctApurado - px) < Math.abs(pontos[melhor].pctApurado - px)) melhor = i;
    }
    setIndice(melhor);
    const p = pontos[melhor];
    const linhas = series
      .map((s) => ({ s, v: p.valores[s.sqcand] }))
      .filter((l) => typeof l.v === "number")
      .sort((a, b) => b.v - a.v);
    setDica({
      x: ev.clientX,
      y: ev.clientY,
      conteudo: (
        <div className="space-y-1.5">
          <p className="tabular font-semibold">
            {fmtPct(p.pctApurado)} apurado
            {p.geradoEm && (
              <span className="ml-1.5 font-normal text-ink-muted">
                · {new Date(p.geradoEm).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}
              </span>
            )}
          </p>
          <ul className="tabular space-y-0.5">
            {linhas.map(({ s, v }) => (
              <li key={s.sqcand} className="flex items-center gap-2">
                <span aria-hidden className="h-0.5 w-3 shrink-0 rounded" style={{ background: s.cor }} />
                <span className="truncate">{s.nome}</span>
                <span className="ml-auto font-semibold">{fmtPct(v)}</span>
              </li>
            ))}
          </ul>
        </div>
      ),
    });
  };

  const ponto = indice !== null ? pontos[indice] : null;
  const desde = pontos.reduce<string | null>(
    (min, p) => (p.geradoEm && (!min || p.geradoEm < min) ? p.geradoEm : min),
    null,
  );

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        {/* Legenda sempre presente; texto em tinta de texto. */}
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink">
          {series.map((s) => (
            <li key={s.sqcand} className="flex items-center gap-1.5">
              <span aria-hidden className="h-0.5 w-4 rounded" style={{ background: s.cor }} />
              {s.nome}
              <span className="text-ink-muted">{s.partido}</span>
            </li>
          ))}
        </ul>
        <BotaoSecundario onClick={() => setVerTabela((v) => !v)} aria-pressed={verTabela}>
          {verTabela ? "Ver gráfico" : "Ver tabela"}
        </BotaoSecundario>
      </div>

      {verTabela ? (
        <TabelaHistorico pontos={pontos} series={series} />
      ) : (
        <div ref={ref} className="w-full">
          {largura > 0 && (
            <svg
              width={largura}
              height={ALTURA}
              role="img"
              aria-label={`Evolução do percentual de votos de ${series.map((s) => s.nome).join(", ")} conforme a apuração avança`}
            >
              <g transform={`translate(${M.esquerda},${M.topo})`}>
                {/* Grade e eixos recessivos. */}
                {y.ticks(5).map((t) => (
                  <g key={t} transform={`translate(0,${y(t)})`}>
                    <line x2={larguraPlot} style={{ stroke: "var(--grid)" }} />
                    <text x={-8} dy="0.32em" textAnchor="end" className="tabular" style={{ fill: "var(--text-muted)", fontSize: 11 }}>
                      {t}%
                    </text>
                  </g>
                ))}
                <line y1={alturaPlot} y2={alturaPlot} x2={larguraPlot} style={{ stroke: "var(--baseline)" }} />
                {x.ticks(Math.max(2, Math.floor(larguraPlot / 80))).map((t) => (
                  <text
                    key={t}
                    x={x(t)}
                    y={alturaPlot + 18}
                    textAnchor="middle"
                    className="tabular"
                    style={{ fill: "var(--text-muted)", fontSize: 11 }}
                  >
                    {t}%
                  </text>
                ))}
                <text
                  x={larguraPlot}
                  y={alturaPlot + 32}
                  textAnchor="end"
                  style={{ fill: "var(--text-muted)", fontSize: 11 }}
                >
                  urnas apuradas
                </text>
  
                {mostrar50 && (
                  <g transform={`translate(0,${y(50)})`}>
                    <line x2={larguraPlot} strokeDasharray="4 4" style={{ stroke: "var(--baseline)" }} />
                    <text x={4} dy="-0.4em" style={{ fill: "var(--text-muted)", fontSize: 11 }}>
                      50% dos válidos
                    </text>
                  </g>
                )}
  
                {series.map((s) =>
                  s.pontos.length > 1 ? (
                    <path
                      key={s.sqcand}
                      d={gerador(s.pontos) ?? ""}
                      fill="none"
                      className="marca"
                      style={{ stroke: s.cor, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }}
                    />
                  ) : (
                    // Um ponto só ainda não é linha: marcador de 8px.
                    <circle
                      key={s.sqcand}
                      cx={x(s.pontos[0].x)}
                      cy={y(s.pontos[0].y)}
                      r={4}
                      style={{ fill: s.cor, stroke: "var(--surface-1)", strokeWidth: 2 }}
                    />
                  ),
                )}
  
                {/* Rótulos diretos na ponta, empurrados para não colidir. */}
                {rotulos.map((r) => (
                  <g key={r.chave} transform={`translate(${larguraPlot + 8},${r.y})`}>
                    <text dy="0.32em" style={{ fill: "var(--text-primary)", fontSize: 12, fontWeight: 500 }}>
                      <tspan>{truncar(r.texto, 12)}</tspan>
                      <tspan dx={6} className="tabular" style={{ fill: "var(--text-secondary)", fontWeight: 400 }}>
                        {fmtPct(r.valor)}
                      </tspan>
                    </text>
                  </g>
                ))}
  
                {/* Crosshair. */}
                {ponto && (
                  <g>
                    <line
                      x1={x(ponto.pctApurado)}
                      x2={x(ponto.pctApurado)}
                      y2={alturaPlot}
                      style={{ stroke: "var(--text-muted)", strokeWidth: 1 }}
                    />
                    {series.map((s) => {
                      const v = ponto.valores[s.sqcand];
                      if (typeof v !== "number") return null;
                      return (
                        <circle
                          key={s.sqcand}
                          cx={x(ponto.pctApurado)}
                          cy={y(v)}
                          r={4}
                          // Anel de 2px na cor da superfície em marcas sobrepostas.
                          style={{ fill: s.cor, stroke: "var(--surface-1)", strokeWidth: 2 }}
                        />
                      );
                    })}
                  </g>
                )}
  
                {/* Alvo de hover: o plot inteiro, maior que qualquer marca. */}
                <rect
                  width={larguraPlot}
                  height={alturaPlot}
                  fill="transparent"
                  onPointerMove={aoMover}
                  onPointerLeave={() => {
                    setIndice(null);
                    setDica(null);
                  }}
                />
              </g>
            </svg>
          )}
        </div>
      )}

      <p className="mt-2 text-[12px] text-ink-muted">
        Montada neste navegador com os {pontos.length} boletins vistos
        {desde ? ` desde ${new Date(desde).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}` : ""}.
        Não é uma série oficial do TSE.
      </p>

      <Dica dica={dica} />
    </div>
  );
}

const truncar = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** A tabela gêmea do gráfico: todo valor desenhado também é legível como texto. */
function TabelaHistorico({ pontos, series }: { pontos: Historico["pontos"]; series: Serie[] }) {
  const linhas = [...pontos].reverse();
  return (
    <div className="max-h-[280px] overflow-auto rounded-lg border border-hairline">
      <table className="w-full text-[13px]">
        <caption className="sr-only">Evolução do percentual de votos por boletim</caption>
        <thead className="sticky top-0 bg-surface-1 text-left text-ink-2 shadow-[0_1px_0_var(--border)]">
          <tr className="h-9">
            <th scope="col" className="px-3 font-medium">Hora</th>
            <th scope="col" className="px-3 text-right font-medium">Apurado</th>
            {series.map((s) => (
              <th key={s.sqcand} scope="col" className="px-3 text-right font-medium">
                {truncar(s.nome, 14)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular">
          {linhas.map((p) => (
            <tr key={p.idg} className="h-8 border-t border-hairline">
              <th scope="row" className="px-3 text-left font-normal text-ink-2">
                {p.geradoEm
                  ? new Date(p.geradoEm).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })
                  : "—"}
              </th>
              <td className="px-3 text-right">{fmtPct(p.pctApurado)}</td>
              {series.map((s) => (
                <td key={s.sqcand} className="px-3 text-right">
                  {typeof p.valores[s.sqcand] === "number" ? fmtPct(p.valores[s.sqcand]) : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Empurra rótulos sobrepostos para manter pelo menos 15px entre eles. */
function posicionarRotulos<T extends { yAlvo: number }>(itens: T[], altura: number): (T & { y: number })[] {
  const ESPACO = 15;
  const ordenados = [...itens].sort((a, b) => a.yAlvo - b.yAlvo).map((i) => ({ ...i, y: i.yAlvo }));
  for (let i = 1; i < ordenados.length; i++) {
    if (ordenados[i].y - ordenados[i - 1].y < ESPACO) ordenados[i].y = ordenados[i - 1].y + ESPACO;
  }
  // Se estourou por baixo, prende o último na base e propaga para cima.
  const ultimo = ordenados.length - 1;
  if (ultimo >= 0 && ordenados[ultimo].y > altura) {
    ordenados[ultimo].y = altura;
    for (let i = ultimo - 1; i >= 0; i--) {
      ordenados[i].y = Math.min(ordenados[i].y, ordenados[i + 1].y - ESPACO);
    }
  }
  return ordenados;
}
