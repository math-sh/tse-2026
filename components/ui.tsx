"use client";

import { useState, type ReactNode } from "react";
import { corPartido } from "@/lib/viz/partidos";

/* ------------------------------------------------------------------ Cartão */

export function Cartao({
  titulo,
  subtitulo,
  acoes,
  children,
  className = "",
}: {
  titulo: string;
  subtitulo?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-xl border border-hairline bg-surface-1 p-4 sm:p-5 ${className}`}
      aria-label={titulo}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-[13px] text-ink-2">{subtitulo}</p>}
        </div>
        {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
      </header>
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------- Foto */

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

/**
 * Foto oficial do TSE com fallback para iniciais. Nos cargos proporcionais
 * muitas fotos faltam, e um 404 não pode abrir buraco no layout.
 *
 * `<img>` simples em vez de next/image: as fotos já vêm do CDN do TSE em
 * ~7 KB, e passá-las pelo otimizador só poria nosso servidor no caminho de
 * centenas de requisições.
 */
export function Foto({ url, nome, tamanho = 36 }: { url: string | null; nome: string; tamanho?: number }) {
  const [falhou, setFalhou] = useState(false);
  const estilo = { width: tamanho, height: tamanho };

  if (!url || falhou) {
    return (
      <span
        aria-hidden
        style={{ ...estilo, fontSize: Math.max(10, tamanho * 0.36) }}
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold text-ink-2 ring-1 ring-hairline"
      >
        {iniciais(nome)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFalhou(true)}
      style={estilo}
      className="shrink-0 rounded-full bg-surface-2 object-cover object-top ring-1 ring-hairline"
    />
  );
}

/* ------------------------------------------------------------ Chip partido */

/**
 * O chip carrega a cor partidária; o texto ao lado fica sempre em tinta de
 * texto. Identidade nunca depende só da cor: a sigla está escrita do lado.
 */
export function ChipPartido({ sigla, numero }: { sigla: string; numero?: string }) {
  if (!sigla) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: corPartido(sigla) }} />
      <span className="truncate">{sigla}</span>
      {numero && <span className="tabular text-ink-muted">{numero}</span>}
    </span>
  );
}

/* ----------------------------------------------------------------- Tooltip */

export interface EstadoDica {
  x: number;
  y: number;
  conteudo: ReactNode;
}

/** Tooltip em posição fixa, que segue o ponteiro e não sai da tela. */
export function Dica({ dica }: { dica: EstadoDica | null }) {
  if (!dica) return null;
  const largura = 260;
  const margem = 14;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const esquerda = dica.x + margem + largura > vw ? dica.x - margem - largura : dica.x + margem;

  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 rounded-lg border border-hairline bg-surface-1 p-3 text-[13px] text-ink shadow-lg"
      style={{ left: Math.max(8, esquerda), top: dica.y + margem, width: largura }}
    >
      {dica.conteudo}
    </div>
  );
}

/* ------------------------------------------------------------ Estado vazio */

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-hairline px-6 py-8 text-center text-[13px] text-ink-2">
      <div className="max-w-sm">{children}</div>
    </div>
  );
}

/** Botão secundário — usado nas ações dos cartões. */
export function BotaoSecundario({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-hairline bg-surface-1 px-2.5 text-[13px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--seq-500)] disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

/** Alternador segmentado (ex.: "Líder | % apurado" no mapa). */
export function Segmentado<T extends string>({
  opcoes,
  valor,
  aoMudar,
  rotulo,
}: {
  opcoes: { valor: T; rotulo: string; desabilitado?: boolean }[];
  valor: T;
  aoMudar: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="inline-flex rounded-md border border-hairline p-0.5">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          disabled={o.desabilitado}
          onClick={() => aoMudar(o.valor)}
          className={`h-7 rounded px-2.5 text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            valor === o.valor ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:text-ink"
          }`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}
