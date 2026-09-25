# Como contribuir

O jeito mais útil de ajudar este projeto não é escrever código: é dizer qual
banco você usa e se o arquivo dele importou. Cada banco tem um dialeto, e eu só
tenho acesso aos meus.

## Antes de qualquer coisa: nunca envie extrato real

O arquivo do seu banco tem CPF, CNPJ, agência, conta e nome de quem te mandou
Pix no meio das descrições. **Não anexe extrato em issue, em pull request nem em
teste.**

A primeira linha do arquivo — só o cabeçalho, sem nenhuma transação — já basta
para eu reconhecer o formato. O `.gitignore` bloqueia `*.csv` e `*.ofx` antes de
qualquer outra coisa, de propósito.

## Sem escrever código

- **[Meu banco não importa](https://github.com/MinuaxY/bolso/issues/new?template=banco-nao-importa.yml)** — o mais valioso.
- **[Categorizou errado](https://github.com/MinuaxY/bolso/issues/new?template=erro-de-categorizacao.yml)** — se a regra serve para outras pessoas, ela entra nas regras de fábrica.
- **[Um número não bate](https://github.com/MinuaxY/bolso/issues/new?template=numero-nao-bate.yml)** — o problema mais importante que este projeto pode receber.

## Escrevendo código

```bash
npm install
npm run verificar   # lint, tipos e testes com cobertura — o mesmo que o CI roda
npm run dev -w @bolso/web
```

O repositório tem três pacotes: `packages/core` (domínio em TypeScript puro, sem
nenhuma dependência), `packages/parsers` (leitores de arquivo) e `apps/web` (a
interface). As convenções estão em [`docs/convencoes.md`](docs/convencoes.md) —
leia antes, porque duas delas não são óbvias: dinheiro é sempre inteiro em
centavos, e data de compra é string `AAAA-MM-DD` sem fuso.

### Adicionar uma regra de categorização

As regras vivem em `packages/core/dados/regras-padrao.json`, e **a ordem
importa**: vale a primeira que casar. `99food` precisa vir antes de `99`.

Acrescente regras genéricas no fim do arquivo — rede conhecida, abreviação que o
banco usa. Estabelecimento local que só existe na sua cidade não entra nas regras
de fábrica; para esse caso, a fila de revisão do app cria a regra só para você,
em um clique.

### Adicionar um banco

Em `packages/parsers/src/fontes.ts`, um banco conhecido é só um mapeamento de
colunas mais uma convenção de sinal. Não escreva um leitor novo: acrescente uma
entrada em `FONTES` e um teste com **amostra inventada** que tenha a mesma forma
do arquivo real.

Se for OFX, provavelmente já funciona — o leitor de OFX é genérico.

### O que o teste precisa provar

Teste que só passa em dado inventado com forma inventada não prova nada. Os
testes deste repositório usam descrições com a mesma forma das reais
(`99food *Jyk Food`, `Amazon Marketplace Cc - Parcela 4/8`) com valores
fictícios — e os cálculos fiscais são conferidos contra guias reais, com os
valores no teste e nada que identifique a empresa.

## O que este projeto não vai aceitar

- Integração que peça senha de banco, ou biblioteca de engenharia reversa.
- Telemetria, analytics ou qualquer coisa que mande dado para fora. A política de
  segurança declara `connect-src 'none'` e isso não é negociável.
- Dependência nova em `packages/core`. Ele é deliberadamente sem dependência
  nenhuma.
- Tabela fiscal escrita dentro do código. Elas vivem em JSON com ano de vigência.

O raciocínio de cada uma está em [`docs/seguranca.md`](docs/seguranca.md) e
[`docs/conceito.md`](docs/conceito.md).
