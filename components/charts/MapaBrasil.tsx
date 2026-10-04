"use client";

import { geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import { useEffect, useId, useMemo, useState } from "react";
import malhaJson from "@/data/malha-uf.json";
import { useLargura } from "@/lib/cliente";
import { fmtPct } from "@/lib/tse/parse";
import type { Mapa, ResumoUf } from "@/lib/tse/tipos-mapa";
import { ufPorIbge } from "@/lib/tse/ufs";
import { DE_EMPHASIS, MAX_SERIES_MAPA, NEUTRO, corSequencial, slotsEstaveis } from "@/lib/viz/palette";
import { BotaoSecundario, Dica, Segmentado, type EstadoDica } from "@/components/ui";

const malha = malhaJson as unknown as FeatureCollection<Geometry, { codarea: string }>;

type Modo = "lider" | "apuracao";

/**
 * Coroplético por UF.
 *
 * Modo "líder" só existe para Presidente: é o único cargo com os mesmos
 * candidatos nas 27 UFs, então a cor significa a mesma pessoa em todo o mapa.
 * No coroplético vale o critério de TODOS os pares, e só os 3 primeiros slots
 * da paleta passam nele — por isso no máximo 3 candidatos ganham cor e o resto
 * vai para o cinza de "outro candidato".
 *
 * Modo "% apurado": rampa sequencial de um matiz, mais escuro = mais apurado.
 *
 * A tabela ao lado ("Ver tabela") é a rota acessível — e é ela que satisfaz a
 * regra de alívio para o slot aqua, que fica abaixo de 3:1 no tema claro.
 */
export function MapaBrasil({
  mapa,
  ufSelecionada,
  aoSelecionar,
  compacto = false,
  alturaMaxima,
}: {
  mapa: Mapa;
  ufSelecionada: string | null;
  aoSelecionar: (uf: string | null) => void;
  /** Modo telão: sem alternadores nem botões, só mapa e legenda. */
  compacto?: boolean;
  /** Limita a altura do desenho (o telão precisa caber numa tela só). */
  alturaMaxima?: number;
}) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [modo, setModo] = useState<Modo>(mapa.agregavel ? "lider" : "apuracao");
  const [foco, setFoco] = useState<string | null>(null);
  const [dica, setDica] = useState<EstadoDica | null>(null);
  const [verTabela, setVerTabela] = useState(false);
  const idHachura = useId().replace(/:/g, "");

  // Trocar de cargo pode tornar o modo "líder" inválido.
  useEffect(() => {
    if (!mapa.agregavel && modo === "lider") setModo("apuracao");
  }, [mapa.agregavel, modo]);

  const porUf = useMemo(() => new Map(mapa.estados.map((e) => [e.uf, e])), [mapa.estados]);

  // Os 3 primeiros no agregado nacional ganham cor; o slot segue o sqcand, não a
  // colocação, então uma ultrapassagem entre eles não repinta o mapa.
  const destaques = useMemo(
    () => mapa.nacional.filter((c) => c.votos > 0).slice(0, MAX_SERIES_MAPA),
    [mapa.nacional],
  );
  const slots = useMemo(
    () => slotsEstaveis(destaques.map((c) => c.sqcand), MAX_SERIES_MAPA),
    [destaques],
  );

  const altura = Math.round(Math.min(largura * 0.96, alturaMaxima ?? Infinity));
  const caminhos = useMemo(() => {
    if (largura <= 0) return [];
    const projecao = geoMercator().fitSize([largura, altura], malha);
    const gerador = geoPath(projecao);
    return malha.features.map((f) => {
      const uf = ufPorIbge(f.properties.codarea);
      return { sigla: uf?.sigla ?? f.properties.codarea, d: gerador(f) ?? "" };
    });
  }, [largura, altura]);

  const preenchimento = (e: ResumoUf | undefined): string => {
    if (!e || !e.elegivel) return "var(--surface-2)";
    if (!e.disponivel) return `url(#${idHachura})`;
    if (modo === "apuracao") return corSequencial(e.pctApurado / 100);
    if (!e.lider) return NEUTRO;
    return slots.get(e.lider.sqcand) ?? DE_EMPHASIS;
  };

  const algumOutroLider = mapa.estados.some((e) => e.lider && !slots.has(e.lider.sqcand));
  const algumSemVoto = mapa.estados.some((e) => e.elegivel && e.disponivel && !e.lider);

  const mostrarDica = (x: number, y: number, e: ResumoUf | undefined) => {
    if (!e) return setDica(null);
    setDica({ x, y, conteudo: <ConteudoDica e={e} cargo={mapa.cargo.nome} /> });
  };

  // O selecionado (e o focado) são desenhados por último, para o contorno ficar por cima.
  const ordenados = [...caminhos].sort(
    (a, b) =>
      Number(a.sigla === ufSelecionada || a.sigla === foco) -
      Number(b.sigla === ufSelecionada || b.sigla === foco),
  );

  return (
    <div className="flex flex-col gap-3">
      {!compacto && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmentado<Modo>
            rotulo="Colorir o mapa por"
            valor={modo}
            aoMudar={setModo}
            opcoes={[
              { valor: "lider", rotulo: "Líder", desabilitado: !mapa.agregavel },
              { valor: "apuracao", rotulo: "% apurado" },
            ]}
          />
          <div className="flex gap-2">
            {ufSelecionada && (
              <BotaoSecundario onClick={() => aoSelecionar(null)}>Ver Brasil</BotaoSecundario>
            )}
            <BotaoSecundario onClick={() => setVerTabela((v) => !v)} aria-pressed={verTabela}>
              {verTabela ? "Ver mapa" : "Ver tabela"}
            </BotaoSecundario>
          </div>
        </div>
      )}

      {!mapa.agregavel && !compacto && (
        <p className="text-[12px] text-ink-2">
          Em {mapa.cargo.nome} cada estado tem candidatos próprios, então pintar por líder não
          compararia a mesma pessoa. O mapa mostra o andamento; o líder de cada UF está no tooltip e na tabela.
        </p>
      )}

      {verTabela ? (
        <TabelaUfs mapa={mapa} aoSelecionar={aoSelecionar} ufSelecionada={ufSelecionada} />
      ) : (
        <div ref={ref} className="relative w-full" style={{ minHeight: 200 }}>
          {largura > 0 && (
            <svg
              width={largura}
              height={altura}
              viewBox={`0 0 ${largura} ${altura}`}
              role="group"
              aria-label={`Mapa do Brasil por UF — ${modo === "lider" ? "líder" : "% de urnas apuradas"}`}
              onPointerLeave={() => {
                setDica(null);
                setFoco(null);
              }}
            >
              <defs>
                {/* Textura a 45°: UF que deveria ter dado e não respondeu. */}
                <pattern id={idHachura} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                  <rect width="6" height="6" style={{ fill: NEUTRO }} />
                  <line x1="0" y1="0" x2="0" y2="6" style={{ stroke: "var(--baseline)", strokeWidth: 2 }} />
                </pattern>
              </defs>
              {ordenados.map(({ sigla, d }) => {
                const e = porUf.get(sigla);
                const selecionada = sigla === ufSelecionada;
                const focada = sigla === foco;
                const clicavel = !!e?.elegivel;
                return (
                  <path
                    key={sigla}
                    d={d}
                    className="marca transition-[fill] duration-500"
                    style={{
                      fill: preenchimento(e),
                      // Contorno na cor da superfície = o vão de 2px entre preenchimentos.
                      stroke: selecionada || focada ? "var(--text-primary)" : "var(--surface-1)",
                      strokeWidth: selecionada ? 2.5 : focada ? 1.75 : 1,
                      cursor: clicavel ? "pointer" : "default",
                      outline: "none",
                      opacity: ufSelecionada && !selecionada && !focada ? 0.55 : 1,
                    }}
                    tabIndex={clicavel ? 0 : -1}
                    role="button"
                    aria-pressed={selecionada}
                    aria-label={rotuloAcessivel(e, mapa.cargo.nome)}
                    onPointerMove={(ev) => {
                      setFoco(sigla);
                      mostrarDica(ev.clientX, ev.clientY, e);
                    }}
                    onFocus={(ev) => {
                      setFoco(sigla);
                      const r = (ev.target as SVGPathElement).getBoundingClientRect();
                      mostrarDica(r.right, r.top, e);
                    }}
                    onBlur={() => {
                      setFoco(null);
                      setDica(null);
                    }}
                    onClick={() => clicavel && aoSelecionar(selecionada ? null : sigla)}
                    onKeyDown={(ev) => {
                      if (clicavel && (ev.key === "Enter" || ev.key === " ")) {
                        ev.preventDefault();
                        aoSelecionar(selecionada ? null : sigla);
                      }
                    }}
                  />
                );
              })}
            </svg>
          )}
        </div>
      )}

      {/* Legenda sempre presente. Texto em tinta de texto; a cor fica só na amostra. */}
      {modo === "lider" ? (
        <ul className="flex flex-col gap-1.5 text-[13px] text-ink">
          {destaques.length === 0 && (
            <li className="flex items-center gap-2 text-ink-2">
              <Amostra cor={NEUTRO} /> Nenhum voto apurado ainda
            </li>
          )}
          {destaques.map((c) => (
            <li key={c.sqcand} className="flex items-center gap-2">
              <Amostra cor={slots.get(c.sqcand)!} />
              <span className="font-medium">{c.nomeUrna}</span>
              <span className="text-ink-2">{c.partido}</span>
              <span className="tabular ml-auto text-ink-2">
                {fmtPct(c.pct)} {c.fonte === "brasil" ? "no país" : "nas 27 UFs"}
              </span>
            </li>
          ))}
          {algumOutroLider && (
            <li className="flex items-center gap-2 text-ink-2">
              <Amostra cor={DE_EMPHASIS} /> Outro candidato lidera
            </li>
          )}
          {destaques.length > 0 && algumSemVoto && (
            <li className="flex items-center gap-2 text-ink-2">
              <Amostra cor={NEUTRO} /> Sem votos apurados
            </li>
          )}
          <LegendaIndisponivel mapa={mapa} idHachura={idHachura} />
        </ul>
      ) : (
        <div>
          <div className="flex h-2.5 overflow-hidden rounded-sm" style={{ gap: 2 }}>
            {[0.07, 0.21, 0.36, 0.5, 0.64, 0.79, 0.93].map((t) => (
              <div key={t} className="flex-1" style={{ background: corSequencial(t) }} />
            ))}
          </div>
          <div className="tabular mt-1 flex justify-between text-[12px] text-ink-muted">
            <span>0%</span>
            <span>50%</span>
            <span>100% das urnas apuradas</span>
          </div>
          <ul className="mt-2 text-[13px]">
            <LegendaIndisponivel mapa={mapa} idHachura={idHachura} />
          </ul>
        </div>
      )}

      <Dica dica={dica} />
    </div>
  );
}

function Amostra({ cor }: { cor: string }) {
  return <span aria-hidden className="size-3 shrink-0 rounded-sm ring-1 ring-hairline" style={{ background: cor }} />;
}

function LegendaIndisponivel({ mapa, idHachura }: { mapa: Mapa; idHachura: string }) {
  if (mapa.indisponiveis.length === 0) return null;
  return (
    <li className="flex items-center gap-2 text-ink-2">
      <svg aria-hidden width="12" height="12" className="shrink-0 rounded-sm">
        <rect width="12" height="12" style={{ fill: `url(#${idHachura})` }} />
      </svg>
      Sem resposta do TSE: {mapa.indisponiveis.map((u) => u.toUpperCase()).join(", ")}
    </li>
  );
}

function rotuloAcessivel(e: ResumoUf | undefined, cargo: string): string {
  if (!e) return "";
  if (!e.elegivel) return `${e.nome}: não elege ${cargo}`;
  if (!e.disponivel) return `${e.nome}: sem resposta do TSE`;
  const lider = e.lider ? `, lidera ${e.lider.nomeUrna} com ${fmtPct(e.lider.pct)}` : ", sem votos apurados";
  return `${e.nome}: ${fmtPct(e.pctApurado)} apurado${lider}`;
}

function ConteudoDica({ e, cargo }: { e: ResumoUf; cargo: string }) {
  return (
    <div className="space-y-1.5">
      <p className="font-semibold">{e.nome}</p>
      {!e.elegivel ? (
        <p className="text-ink-2">Não elege {cargo}.</p>
      ) : !e.disponivel ? (
        <p className="text-ink-2">O TSE não respondeu para esta UF na última consulta.</p>
      ) : (
        <>
          <p className="tabular text-ink-2">{fmtPct(e.pctApurado)} das urnas apuradas</p>
          {e.lider ? (
            <div className="tabular space-y-0.5 border-t border-hairline pt-1.5">
              <p className="flex justify-between gap-2">
                <span className="truncate">1º {e.lider.nomeUrna} <span className="text-ink-2">{e.lider.partido}</span></span>
                <b>{fmtPct(e.lider.pct)}</b>
              </p>
              {e.segundo && (
                <p className="flex justify-between gap-2 text-ink-2">
                  <span className="truncate">2º {e.segundo.nomeUrna} {e.segundo.partido}</span>
                  <span>{fmtPct(e.segundo.pct)}</span>
                </p>
              )}
              {e.margem !== null && (
                <p className="text-[12px] text-ink-muted">
                  Vantagem de {e.margem.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} p.p.
                </p>
              )}
            </div>
          ) : (
            <p className="text-ink-2">Sem votos apurados ainda.</p>
          )}
          <p className="text-[12px] text-ink-muted">Clique para filtrar este estado.</p>
        </>
      )}
    </div>
  );
}

function TabelaUfs({
  mapa,
  ufSelecionada,
  aoSelecionar,
}: {
  mapa: Mapa;
  ufSelecionada: string | null;
  aoSelecionar: (uf: string | null) => void;
}) {
  const linhas = mapa.estados.filter((e) => e.elegivel);
  return (
    <div className="max-h-[420px] overflow-auto rounded-lg border border-hairline">
      <table className="w-full text-[13px]">
        <caption className="sr-only">Apuração por estado — {mapa.cargo.nome}</caption>
        <thead className="sticky top-0 bg-surface-1 text-left text-ink-2">
          <tr className="border-b border-hairline">
            <th scope="col" className="px-3 py-2 font-medium">UF</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Apurado</th>
            <th scope="col" className="px-3 py-2 font-medium">Líder</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">%</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {linhas.map((e) => (
            <tr
              key={e.uf}
              className={`cursor-pointer border-b border-hairline last:border-0 hover:bg-surface-2 ${e.uf === ufSelecionada ? "bg-surface-2" : ""}`}
              onClick={() => aoSelecionar(e.uf === ufSelecionada ? null : e.uf)}
            >
              <th scope="row" className="px-3 py-1.5 text-left font-medium">{e.uf.toUpperCase()}</th>
              <td className="px-3 py-1.5 text-right">{e.disponivel ? fmtPct(e.pctApurado) : "—"}</td>
              <td className="max-w-40 truncate px-3 py-1.5">
                {e.lider ? `${e.lider.nomeUrna} (${e.lider.partido})` : <span className="text-ink-muted">—</span>}
              </td>
              <td className="px-3 py-1.5 text-right">{e.lider ? fmtPct(e.lider.pct) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
