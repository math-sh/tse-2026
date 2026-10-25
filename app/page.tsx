import { Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";
import { lerFiltros, precisaDeUf } from "@/lib/filtros";
import { obterMapa, obterResultado } from "@/lib/tse/servico";

type Params = Promise<Record<string, string | string[] | undefined>>;

/**
 * A primeira renderização sai do servidor já com o recorte da URL — quem abre
 * um link compartilhado vê o resultado de cara, sem esqueleto. Daí em diante o
 * cliente assume o polling.
 */
export default async function Pagina({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const filtros = lerFiltros({
    get: (k) => {
      const v = sp[k];
      return (Array.isArray(v) ? v[0] : v) ?? null;
    },
  });

  const [resultado, mapa] = await Promise.all([
    precisaDeUf(filtros) ? null : obterResultado(filtros),
    obterMapa(filtros.cargo),
  ]);

  return (
    <Suspense>
      <Dashboard
        inicial={{
          filtros,
          boletim: resultado?.ok ? resultado.dados : null,
          mapa: mapa?.ok ? mapa.dados : null,
        }}
      />
    </Suspense>
  );
}
