/**
 * Cliente HTTP para o TSE.
 *
 * Dois fatos medidos em 04/10/2026 que moldam este arquivo:
 *  - O TSE responde `Cache-Control: max-age=50`. Buscar mais rápido que isso não
 *    traz dado novo, só queima requisição — por isso o `revalidate` nunca desce
 *    abaixo de 30s em quem chama.
 *  - `X-RateLimit-Limit: 2000, 2000;w=1` é por IP. Como todo acesso passa pelo
 *    servidor, o IP é compartilhado por todos os usuários: o cache do Next é o
 *    que segura esse limite, não a boa vontade do cliente.
 */

export class TseNaoEncontrado extends Error {
  readonly status = 404;
  constructor(url: string) {
    super(`O TSE não publica este arquivo (404): ${url}`);
    this.name = "TseNaoEncontrado";
  }
}

export class TseIndisponivel extends Error {
  constructor(url: string, readonly causa: string) {
    super(`Falha ao consultar o TSE (${causa}): ${url}`);
    this.name = "TseIndisponivel";
  }
}

const TIMEOUT_MS = 10_000;
const TENTATIVAS = 3;

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Busca e desserializa um JSON do TSE.
 *
 * Um 404 não é tentado de novo: significa que o arquivo não existe (cargo no
 * nível errado, UF sem aquele cargo), e repetir só gasta a cota. Erro de rede e
 * 5xx são retentados com backoff.
 */
export async function buscarTse<T>(url: string, revalidate: number): Promise<T> {
  let ultimoErro = "desconhecido";

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      const resposta = await fetch(url, {
        next: { revalidate },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: "application/json" },
      });

      if (resposta.status === 404) throw new TseNaoEncontrado(url);

      if (!resposta.ok) {
        ultimoErro = `HTTP ${resposta.status}`;
        if (resposta.status < 500 && resposta.status !== 429) {
          throw new TseIndisponivel(url, ultimoErro);
        }
      } else {
        // O TSE serve com charset UTF-8 mas sem declarar em alguns arquivos;
        // ler como texto e parsear nós mesmos evita surpresa de acentuação.
        const texto = await resposta.text();
        return JSON.parse(texto) as T;
      }
    } catch (erro) {
      if (erro instanceof TseNaoEncontrado || erro instanceof TseIndisponivel) throw erro;
      ultimoErro = erro instanceof Error ? erro.message : String(erro);
    }

    if (tentativa < TENTATIVAS) await espera(300 * 2 ** (tentativa - 1));
  }

  throw new TseIndisponivel(url, ultimoErro);
}

/** Janelas de revalidação, alinhadas ao `max-age=50` do próprio TSE. */
export const REVALIDATE = {
  /** Resultados: muda a cada boletim. */
  resultado: 30,
  /** Config de eleições e lista de municípios: estáveis durante o pleito. */
  config: 3600,
} as const;
