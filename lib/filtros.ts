/**
 * Cascata dos filtros — função pura, sem React, para ser testável e usada tanto
 * pelo seletor quanto pela leitura da URL.
 *
 * O estado (cargo=3, uf=null) é permitido de propósito: "Governador no Brasil"
 * não tem boletim no TSE, mas tem mapa. Nesse caso o dashboard mostra o mapa
 * das 27 UFs e pede para escolher um estado, em vez de esconder o cargo do
 * seletor até alguém adivinhar que precisa escolher a UF primeiro.
 */
import { CARGOS, cargoPorCodigo, type Cargo } from "@/lib/tse/cargos";
import { ehUfValida } from "@/lib/tse/ufs";

export interface FiltrosUrl {
  cargo: string;
  uf: string | null;
  mu: string | null;
}

/** Lê e saneia os parâmetros da URL. Valor inválido vira o padrão, não erro. */
export function lerFiltros(p: { get(nome: string): string | null }): FiltrosUrl {
  const uf = p.get("uf")?.toLowerCase() ?? null;
  const mu = p.get("mu");
  const cargo = p.get("cargo") ?? "1";
  return ajustarFiltros(
    { cargo: "1", uf: null, mu: null },
    {
      cargo: cargoPorCodigo(cargo) ? cargo : "1",
      uf: uf && ehUfValida(uf) ? uf : null,
      mu: mu && /^\d{5}$/.test(mu) ? mu : null,
    },
  );
}

/** Os cargos que o seletor oferece para um recorte. */
export function cargosDoSeletor(uf: string | null, mu: string | null): Cargo[] {
  return CARGOS.filter((c) => {
    if (c.apenasMunicipio) return mu === c.apenasMunicipio;
    if (c.apenasUfs) return !!uf && c.apenasUfs.includes(uf);
    if (c.excetoUfs && uf && c.excetoUfs.includes(uf)) return false;
    return true;
  });
}

/** O cargo existe, mas não no nível Brasil: falta escolher um estado. */
export function precisaDeUf(f: FiltrosUrl): boolean {
  const cargo = cargoPorCodigo(f.cargo);
  return !!cargo && !f.uf && !cargo.niveis.includes("br");
}

/** Aplica uma mudança e resolve as dependências entre os campos. */
export function ajustarFiltros(atual: FiltrosUrl, mudanca: Partial<FiltrosUrl>): FiltrosUrl {
  let { cargo, uf, mu } = { ...atual, ...mudanca };

  // Trocar de UF invalida o município; sem UF não existe município.
  if ("uf" in mudanca && mudanca.uf !== atual.uf && !("mu" in mudanca)) mu = null;
  if (!uf) mu = null;

  const oferecidos = cargosDoSeletor(uf, mu).map((c) => c.codigo);
  if (!oferecidos.includes(cargo)) {
    // Trocas que preservam a intenção: quem olhava Dep. Estadual e foi para o
    // DF quer ver Dep. Distrital, e vice-versa.
    if (cargo === "7" && oferecidos.includes("8")) cargo = "8";
    else if (cargo === "8" && oferecidos.includes("7")) cargo = "7";
    else cargo = oferecidos[0] ?? "1";
  }

  return { cargo, uf, mu };
}

export function filtrosParaQuery(f: FiltrosUrl): string {
  const p = new URLSearchParams();
  if (f.cargo !== "1") p.set("cargo", f.cargo);
  if (f.uf) p.set("uf", f.uf);
  if (f.mu) p.set("mu", f.mu);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const chaveFiltros = (f: FiltrosUrl) => `${f.cargo}:${f.uf ?? "br"}:${f.mu ?? "-"}`;
