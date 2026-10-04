"use client";

import { useEffect, useState } from "react";
import { INTERVALO_MS, useAgora } from "@/lib/cliente";

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });

/**
 * Duas horas diferentes, e as duas importam:
 *  - a de geração do boletim NO TSE (`dg`/`hg`) — é o "de quando é este dado";
 *  - a da nossa última consulta — é o "o painel está vivo?".
 * Um painel que diz só "atualizado agora" esconde que o boletim pode ter 10 min.
 */
export function StatusAtualizacao({
  geradoEm,
  consultadoEm,
  buscando,
  erro,
  aoAtualizar,
}: {
  geradoEm: string | null;
  consultadoEm: number;
  buscando: boolean;
  erro: string | null;
  aoAtualizar: () => void;
}) {
  const agora = useAgora(1000);
  const segundos = consultadoEm ? Math.max(0, Math.round((agora - consultadoEm) / 1000)) : null;
  const proxima = consultadoEm
    ? Math.max(0, Math.round((consultadoEm + INTERVALO_MS - agora) / 1000))
    : null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
      {erro ? (
        <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: "var(--status-critical)" }} role="status">
          <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5l6.5 12H1.5L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M8 6v3.5M8 11.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Última consulta falhou{geradoEm ? ` — mostrando o boletim das ${hora(geradoEm)}` : ""}
        </span>
      ) : (
        geradoEm && (
          <span className="text-ink">
            Boletim do TSE das <b className="tabular font-semibold">{hora(geradoEm)}</b>
          </span>
        )
      )}

      <span className="tabular inline-flex items-center gap-1.5 text-ink-muted" aria-live="off">
        <span
          aria-hidden
          className={`size-1.5 rounded-full ${buscando ? "animate-pulse" : ""}`}
          style={{ background: buscando ? "var(--seq-500)" : "var(--text-muted)" }}
        />
        {buscando
          ? "consultando…"
          : segundos !== null
            ? `verificado há ${segundos}s · próxima em ${proxima}s`
            : "aguardando"}
      </span>

      <button
        type="button"
        onClick={aoAtualizar}
        disabled={buscando}
        className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-ink-2 hover:bg-surface-1 hover:text-ink disabled:opacity-50"
      >
        <svg aria-hidden width="13" height="13" viewBox="0 0 16 16" fill="none" className={buscando ? "animate-spin" : ""}>
          <path d="M13.5 8a5.5 5.5 0 11-1.6-3.9M13.5 2.5v3h-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Atualizar
      </button>
    </div>
  );
}

type Tema = "auto" | "light" | "dark";
const ROTULO: Record<Tema, string> = { auto: "Tema: sistema", light: "Tema: claro", dark: "Tema: escuro" };
const PROXIMO: Record<Tema, Tema> = { auto: "light", light: "dark", dark: "auto" };

/**
 * Alterna sistema → claro → escuro. A preferência fica no localStorage (é uma
 * conveniência por pessoa) e o script em layout.tsx a aplica antes da primeira
 * pintura, para não piscar o tema errado.
 */
export function TemaToggle() {
  const [tema, setTema] = useState<Tema>("auto");

  useEffect(() => {
    try {
      const salvo = localStorage.getItem("tema");
      if (salvo === "light" || salvo === "dark") setTema(salvo);
    } catch {
      /* storage indisponível: fica no tema do sistema */
    }
  }, []);

  const trocar = () => {
    const novo = PROXIMO[tema];
    setTema(novo);
    if (novo === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", novo);
    try {
      if (novo === "auto") localStorage.removeItem("tema");
      else localStorage.setItem("tema", novo);
    } catch {
      /* ignora */
    }
  };

  return (
    <button
      type="button"
      onClick={trocar}
      aria-label={`${ROTULO[tema]}. Clique para alternar.`}
      title={ROTULO[tema]}
      className="inline-flex size-8 items-center justify-center rounded-md border border-hairline bg-surface-1 text-ink-2 hover:text-ink"
    >
      <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
        {tema === "dark" ? (
          <path d="M13 9.5A5.5 5.5 0 016.5 3a5.5 5.5 0 106.5 6.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        ) : tema === "light" ? (
          <>
            <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 2a6 6 0 010 12z" fill="currentColor" />
          </>
        )}
      </svg>
    </button>
  );
}
