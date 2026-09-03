# Convenções do código

Decisões tomadas na sprint 1, antes de existir código para se acostumar com o
contrário. Cada uma tem motivo, porque convenção sem motivo vira discussão de
gosto na primeira revisão.

---

## Idioma: domínio em português

Os nomes do domínio são em português — `Lancamento`, `Despesa`, `Parcela`,
`competenciaDaCompra`, `RegraCategorizacao`. O inglês fica na infraestrutura
técnica, onde é convenção universal (`test`, `build`, `config`).

Metade dos conceitos deste projeto não tem tradução: RBT12, Fator R, DAS, Anexo III,
Simples Nacional, competência. Traduzir a outra metade produziria código meio
inglês meio português, que é pior do que qualquer um dos dois extremos. Nomes em
português também deixam o código legível para quem vai contribuir com as regras
de categorização do banco dele — que é o tipo de contribuição que este projeto
mais quer receber.

Identificadores são escritos **sem acento**, porque acento em nome de símbolo
sobrevive mal a ferramenta, terminal e diff. Comentários e texto de interface
levam acento normalmente.

## Dinheiro é inteiro, em centavos

Todo valor monetário no domínio é `valorCentavos: number`, inteiro e sempre
positivo — o sinal vem do tipo do lançamento, não do número.

Ponto flutuante não representa 0,10 exatamente. Somar mil lançamentos em decimal
produz erro visível no total do mês, e o usuário confere esse total contra o app
do banco. Um erro de centavo destrói a confiança no app inteiro.

Formatar para exibição é responsabilidade da camada de interface, nunca do
núcleo.

## Data de compra não tem fuso

Datas civis são strings `AAAA-MM-DD` e a aritmética vive em `data.ts`. O núcleo
nunca constrói um `Date`.

`new Date('2026-06-02')` é meia-noite em UTC, que no Brasil é dia 1º às 21h. Uma
compra do dia 2 apareceria no dia 1º — e, na virada do mês, na competência
errada. O bug clássico de sistema financeiro brasileiro escrito em JavaScript.

Competência é `AAAA-MM`, pelo mesmo motivo.

## A ordem das regras é informação

As regras de categorização são uma lista ordenada e vale a primeira que casar.
Isso não é detalhe de implementação: `99food` **precisa** vir antes de `99`,
senão toda compra de comida vira corrida de aplicativo. Qualquer refatoração que
transforme a lista em conjunto, mapa ou índice quebra o domínio silenciosamente.

## Divergências deliberadas do VBA de origem

O núcleo é tradução da planilha, mas não é cópia. Onde muda, muda de propósito e
está anotado no código:

| Onde | VBA original | Bolso | Por quê |
|---|---|---|---|
| `encontrarRegra` | Ignorava a coluna "Aplica em" e comparava contra todas as regras | Filtra por tipo antes de buscar | Uma regra de receita capturava despesa |
| `categorizar` | Revisão era um booleano implícito | Motivo explícito: `sem-regra` ou `regra-ambigua` | Pedem telas diferentes: uma quer regra nova, a outra quer uma escolha |
| Ciclo de fatura | Dia 5 fixo em constante | Parâmetro obrigatório | Cada cartão fecha num dia, e a pessoa pode ter mais de um |
| Importação | Colava tudo de novo a cada vez | Deduplicação por contagem | Reimportar o mesmo arquivo dobrava o mês |
| Mojibake | Tabela de 24 caracteres | Reinterpretação de bytes | Cobre todo o Unicode em vez dos acentos previstos |

## O núcleo não conhece o mundo

`packages/core` não importa nada — nem biblioteca, nem `window`, nem
armazenamento, nem framework. Ele recebe dados e devolve dados.

É o que permite testá-lo inteiro sem abrir tela, e é o que vai permitir plugar
armazenamento em nuvem na v2 sem reescrever regra nenhuma.

## Teste conta um caso real

Os testes usam descrições que saíram dos extratos de verdade — `99food *Jyk Food`,
`Amazon Marketplace Cc - Parcela 4/8`, `Ifd*Ifood Club` — com valores fictícios.
Um teste que só passa em dado inventado não prova que o importador funciona.

Extrato real nunca é versionado. Ver [`seguranca.md`](seguranca.md), seção 6.

## Verificação local

```bash
npm run verificar
```

Roda lint, tipos e testes com cobertura, exatamente o que o CI roda. Se passar
aqui, passa lá.
