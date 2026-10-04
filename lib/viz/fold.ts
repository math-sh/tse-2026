/**
 * Dobra a cauda em "Outros".
 *
 * Não é só estética: Deputado Federal em SP tem 1045 candidatos, e o teto do
 * design system é 8 séries categóricas. A regra é explícita — nunca resolver
 * "séries demais" gerando mais matizes, porque um 9º matiz é indistinguível dos
 * existentes sob daltonismo.
 *
 * A tabela completa continua existindo ao lado; dobrar é uma decisão sobre o
 * gráfico, não sobre o dado.
 */
import type { Candidato } from "@/lib/tse/normalize";

export interface Fatia {
  chave: string;
  rotulo: string;
  partido: string;
  numero: string;
  votos: number;
  pct: number;
  eleito: boolean;
  fotoUrl: string | null;
  /** Agregado da cauda: não tem foto nem partido próprio. */
  ehOutros: boolean;
  /** Quantos candidatos a fatia agrega (1, ou o tamanho da cauda). */
  agrega: number;
}

const fatiaDe = (c: Candidato): Fatia => ({
  chave: c.sqcand,
  rotulo: c.nomeUrna,
  // O chip mostra o partido do candidato; federação e coligação ficam no tooltip.
  partido: c.partido,
  numero: c.numero,
  votos: c.votos,
  pct: c.pct,
  eleito: c.eleito,
  fotoUrl: c.fotoUrl,
  ehOutros: false,
  agrega: 1,
});

/**
 * Mantém os `limite` primeiros e soma o resto numa fatia "Outros".
 * Só dobra se a cauda tiver mais de um candidato — dobrar um único candidato em
 * "Outros (1)" esconderia um nome sem economizar nada.
 */
export function dobrar(candidatos: readonly Candidato[], limite: number): Fatia[] {
  if (candidatos.length <= limite + 1) return candidatos.map(fatiaDe);

  const cabeca = candidatos.slice(0, limite).map(fatiaDe);
  const cauda = candidatos.slice(limite);

  cabeca.push({
    chave: "__outros__",
    rotulo: `Outros (${cauda.length})`,
    partido: "",
    numero: "",
    votos: cauda.reduce((s, c) => s + c.votos, 0),
    pct: cauda.reduce((s, c) => s + c.pct, 0),
    eleito: false,
    fotoUrl: null,
    ehOutros: true,
    agrega: cauda.length,
  });

  return cabeca;
}
