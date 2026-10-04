# Apuração 2026 — dashboard em tempo real

Painel da apuração das Eleições 2026 (1º turno, 4/10/2026) com dados oficiais de
divulgação do TSE. Filtros por cargo, estado e município de todo o Brasil.

```bash
npm install
npm run build
npm start          # http://localhost:3000
# ou, para desenvolvimento:
npm run dev
```

Telas:

- `/` — dashboard. O recorte fica na URL: `/?cargo=3&uf=sp&mu=71072`
- `/tv` — modo telão. Rotação configurável: `/tv?visoes=1,3:sp,5:mg&intervalo=15`
  (← → trocam de visão, espaço pausa, F alterna tela cheia)

## O que o dashboard mostra

- % de urnas apuradas, eleitorado, comparecimento, abstenção, brancos e nulos
- Ranking de candidatos (os 8 primeiros + "Outros"; Dep. Federal em SP tem 1045)
- Mapa por UF: por líder (só Presidente) ou por % apurado (todos os cargos)
- Evolução da apuração, montada no navegador a partir dos boletins vistos
- Composição dos votos
- Tabela completa com busca e exportação CSV (abre direto no Excel pt-BR)

Atualiza a cada 30 s. Mais rápido que isso não adianta: o próprio TSE serve os
arquivos com `Cache-Control: max-age=50`.

## Como os dados chegam

O TSE **não envia cabeçalho CORS**, então o navegador não consegue consultá-lo
direto. Todo acesso passa pelas rotas em `app/api/tse/`, que também cacheiam as
respostas — isso protege o limite de requisições do TSE, que é por IP.

| Rota | Origem no TSE | Cache |
|---|---|---|
| `/api/tse/resultado?cargo=&uf=&mu=` | `dados/{uf}/{abr}-c{cargo}-e{ele}-u.json` | 30 s |
| `/api/tse/mapa?cargo=` | 27 UFs em paralelo + boletim Brasil | 30 s |
| `/api/tse/municipios?uf=` | `config/mun-e{ele}-cm.json` | 1 h |
| `/api/tse/eleicoes` | `comum/config/ele-c.json` | 1 h |

Detalhes que custaram para descobrir e estão documentados no código:

- Todo número vem como **string**, com decimal em vírgula (`"41,20"`). Use
  `toInt`/`toPct` de `lib/tse/parse.ts`, nunca `Number()` direto.
- O DF não tem Deputado Estadual (`c0007` → 404); tem Distrital (`c0008`).
- Conselheiro Distrital (Fernando de Noronha) está na eleição 6261, só no nível município.
- Fotos ficam na pasta da UF do **registro**: Presidente em `/fotos/br/`, os demais na sigla da UF.
- `agremiacao.com` é a coligação inteira, não a federação — federações vêm em `carg.fed[]`.

## 2º turno

Em `lib/tse/cargos.ts`, troque `ELE_FEDERAL` por `6258`, `ELE_ESTADUAL` por `6260`
e `TURNO` por `2`. Os códigos vêm do campo `cdt2` do config do TSE; confira em
`/api/tse/eleicoes` antes de trocar.

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `TSE_BASE_URL` | Opcional. Aponta para um espelho ou servidor de teste em vez do TSE. Padrão: `https://resultados.tse.jus.br/oficial` |

## Cores

A paleta foi validada com o script do design system (daltonismo e contraste, claro
e escuro). As barras de candidato usam um matiz só — num ranking ao vivo, cor por
posição faria os candidatos trocarem de cor a cada ultrapassagem. A cor do
partido aparece só no chip ao lado do nome. O mapa usa no máximo 3 cores de
líder, o limite em que a paleta continua distinguível par a par.

## Malha do mapa

`data/malha-uf.json` é a malha oficial do IBGE, embutida no repositório para o
mapa não depender do IBGE no dia da eleição. Para regenerar: `npm run malha`.
O script corrige a orientação dos polígonos (o padrão do IBGE é o inverso do que
o d3-geo espera).
