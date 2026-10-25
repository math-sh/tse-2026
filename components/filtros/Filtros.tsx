"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useMunicipios } from "@/lib/cliente";
import { cargosDoSeletor, type FiltrosUrl } from "@/lib/filtros";
import { cargoPorCodigo } from "@/lib/tse/cargos";
import type { Municipio } from "@/lib/tse/normalize";
import { UFS } from "@/lib/tse/ufs";

const UFS_POR_NOME = [...UFS].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const classeCampo =
  "h-10 w-full rounded-md border border-hairline bg-surface-1 px-3 text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--seq-500)] disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Filtros numa linha só, acima dos gráficos. O estado vive na URL, então
 * qualquer recorte é compartilhável e sobrevive a um recarregamento.
 */
export function Filtros({
  filtros,
  definir,
}: {
  filtros: FiltrosUrl;
  definir: (m: Partial<FiltrosUrl>) => void;
}) {
  const cargos = cargosDoSeletor(filtros.uf, filtros.mu);
  // Governador no 2º turno não tem resultado por município no TSE.
  const semMunicipio = !cargoPorCodigo(filtros.cargo)?.niveis.includes("mu");

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Campo rotulo="Cargo">
        {(id) => (
          <select
            id={id}
            className={classeCampo}
            value={filtros.cargo}
            onChange={(e) => definir({ cargo: e.target.value })}
          >
            {cargos.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.nome}
              </option>
            ))}
          </select>
        )}
      </Campo>

      <Campo rotulo="Estado">
        {(id) => (
          <select
            id={id}
            className={classeCampo}
            value={filtros.uf ?? ""}
            onChange={(e) => definir({ uf: e.target.value || null })}
          >
            <option value="">Brasil — todos os estados</option>
            {UFS_POR_NOME.map((u) => (
              <option key={u.sigla} value={u.sigla}>
                {u.nome} ({u.sigla.toUpperCase()})
              </option>
            ))}
          </select>
        )}
      </Campo>

      <Campo rotulo="Município">
        {(id) => (
          <SeletorMunicipio
            id={id}
            uf={filtros.uf}
            valor={filtros.mu}
            semMunicipio={semMunicipio}
            aoMudar={(mu) => definir({ mu })}
          />
        )}
      </Campo>
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-medium text-ink-2">
        {rotulo}
      </label>
      {children(id)}
    </div>
  );
}

const MAX_OPCOES = 60;

/**
 * Combobox com busca, sem acento e sem caixa. Lista no máximo 60 resultados —
 * acima disso, pede para refinar em vez de despejar 853 municípios mineiros.
 */
function SeletorMunicipio({
  id,
  uf,
  valor,
  semMunicipio,
  aoMudar,
}: {
  id: string;
  uf: string | null;
  valor: string | null;
  /** O cargo atual não tem recorte municipal no TSE. */
  semMunicipio: boolean;
  aoMudar: (mu: string | null) => void;
}) {
  const { data: municipios = [], isLoading, isError } = useMunicipios(semMunicipio ? null : uf);
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const idLista = useId();
  const caixa = useRef<HTMLDivElement>(null);

  const selecionado = useMemo(() => municipios.find((m) => m.codigo === valor) ?? null, [municipios, valor]);

  // Quando o filtro muda por fora (URL, clique no mapa), o texto acompanha.
  useEffect(() => {
    setTexto(selecionado ? titulo(selecionado.nome) : "");
  }, [selecionado]);

  useEffect(() => {
    const fechar = (e: PointerEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) {
        setAberto(false);
        setTexto(selecionado ? titulo(selecionado.nome) : "");
      }
    };
    document.addEventListener("pointerdown", fechar);
    return () => document.removeEventListener("pointerdown", fechar);
  }, [selecionado]);

  const termo = semAcento(texto.trim());
  const filtrados = useMemo(() => {
    if (!termo || (selecionado && texto === titulo(selecionado.nome))) return municipios;
    // Quem começa com o termo vem antes de quem só contém.
    const comeca: Municipio[] = [];
    const contem: Municipio[] = [];
    for (const m of municipios) {
      const n = semAcento(m.nome);
      if (n.startsWith(termo)) comeca.push(m);
      else if (n.includes(termo)) contem.push(m);
    }
    return [...comeca, ...contem];
  }, [municipios, termo, selecionado, texto]);

  const opcoes = filtrados.slice(0, MAX_OPCOES);

  const escolher = (m: Municipio | null) => {
    aoMudar(m?.codigo ?? null);
    setTexto(m ? titulo(m.nome) : "");
    setAberto(false);
  };

  const desabilitado = !uf || semMunicipio;
  let placeholder: string;
  if (semMunicipio) placeholder = "Não se aplica a este cargo";
  else if (!uf) placeholder = "Escolha um estado primeiro";
  else if (isLoading) placeholder = "Carregando municípios…";
  else if (isError) placeholder = "Falha ao carregar municípios";
  else placeholder = `Todos os ${municipios.length} municípios`;

  return (
    <div ref={caixa} className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={aberto}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={aberto && opcoes[ativo] ? `${idLista}-${opcoes[ativo].codigo}` : undefined}
        autoComplete="off"
        disabled={desabilitado}
        placeholder={placeholder}
        value={texto}
        className={`${classeCampo} pr-9`}
        onFocus={(e) => {
          e.currentTarget.select();
          setAberto(true);
        }}
        onChange={(e) => {
          setTexto(e.target.value);
          setAtivo(0);
          setAberto(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setAberto(true);
            setAtivo((a) => Math.min(opcoes.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setAtivo((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (aberto && opcoes[ativo]) escolher(opcoes[ativo]);
          } else if (e.key === "Escape") {
            setAberto(false);
            setTexto(selecionado ? titulo(selecionado.nome) : "");
          }
        }}
      />

      {valor && !desabilitado && (
        <button
          type="button"
          aria-label="Limpar município"
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-ink-muted hover:text-ink"
          onClick={() => escolher(null)}
        >
          <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {aberto && !desabilitado && !isLoading && (
        <ul
          id={idLista}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-hairline bg-surface-1 py-1 text-[14px] shadow-lg"
        >
          {opcoes.length === 0 ? (
            <li className="px-3 py-2 text-ink-2">Nenhum município com “{texto}”.</li>
          ) : (
            opcoes.map((m, i) => (
              <li
                key={m.codigo}
                id={`${idLista}-${m.codigo}`}
                role="option"
                aria-selected={m.codigo === valor}
                className={`flex cursor-pointer items-center justify-between px-3 py-1.5 ${
                  i === ativo ? "bg-surface-2 text-ink" : "text-ink"
                }`}
                onPointerEnter={() => setAtivo(i)}
                onPointerDown={(e) => {
                  e.preventDefault();
                  escolher(m);
                }}
              >
                <span className="truncate">{titulo(m.nome)}</span>
                {m.codigo === valor && (
                  <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                    <path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </li>
            ))
          )}
          {filtrados.length > MAX_OPCOES && (
            <li className="border-t border-hairline px-3 py-2 text-[12px] text-ink-muted">
              Mostrando {MAX_OPCOES} de {filtrados.length}. Digite para refinar.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** "SÃO JOSÉ DOS CAMPOS" → "São José dos Campos". O TSE manda tudo em caixa alta. */
export function titulo(nome: string): string {
  const minusculas = new Set(["de", "da", "do", "das", "dos", "e"]);
  return nome
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((p, i) => (i > 0 && minusculas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join("");
}
