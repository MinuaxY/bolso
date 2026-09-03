# Bolso — conceito do projeto

Documento de planejamento. Escrito em 02/09/2026, antes da primeira linha de código.
Projeto de extensão de Engenharia de Software, segundo semestre de 2026.

---

## 1. De onde vem

O Bolso não começa do zero. Ele junta dois projetos anteriores, cada um com a metade
que o outro não tem.

**FinTrack** (2026, arquivado) — Next.js 14 + FastAPI + Recharts, com telas de painel,
extrato, cartão e investimentos. O problema: as 202 linhas do backend fazem, na prática,
proxy para o Pluggy. Sem `CLIENT_ID` e `CLIENT_SECRET` ninguém consegue rodar, não há
regra de negócio própria e não há testes. Aproveita-se a organização das telas.

**Planilha Financeiro 2026** (em uso) — 19 abas e cerca de 700 linhas de VBA. É aqui que
mora o conhecimento do problema:

- 128 regras de categorização ordenadas, a primeira que casa vence;
- detecção de parcela `X/Y` com saldo devedor e previsão de quitação;
- ciclo de fatura — compra depois do dia 5 cai no mês seguinte;
- previsto contra realizado, por categoria e por forma de pagamento;
- marcação de revisão quando a regra é ambígua, como `99`, que tanto é corrida quanto
  comida.

Aproveita-se tudo: é o núcleo de domínio do Bolso, traduzido de VBA para TypeScript
testável.

---

## 2. Princípios

### 2.1 Os dados ficam com você

Tudo é gravado no IndexedDB do próprio navegador. Extrato bancário é dado sensível, e
não subir isso para lugar nenhum não é limitação técnica — é a proposta. De quebra: sem
servidor, sem custo mensal, sem banco de dados para manter.

### 2.2 Zero configuração

A pessoa abre o endereço e usa. Quem quiser rodar na própria máquina clona o repositório
e dá dois comandos. Nenhuma chave de API, nenhum cadastro, nenhum contêiner. É isso que
faz "qualquer um consegue executar" ser verdade e não promessa de README.

### 2.3 Arquivo em vez de API

O extrato entra pelo CSV ou OFX que o banco já exporta de graça. O núcleo fica atrás de
interfaces, então uma integração via agregador continua possível depois sem reescrever
nada.

---

## 3. Open Finance: por que o caminho gratuito não existe

Pesquisa feita em setembro de 2026, antes de decidir a fonte de dados.

Só instituições autorizadas a funcionar pelo Banco Central participam do Open Finance —
e isso vale **inclusive para o ambiente de testes**: o cadastro no Diretório de
Participantes, em produção e em sandbox, exige comprovação dessa autorização. Não existe
a figura do desenvolvedor pessoa física. A API pública do Banco Central é outra coisa:
dados abertos agregados, como Selic, IPCA e câmbio, não dados de conta.

| Rota | Custo | Serve? |
|---|---|---|
| Open Finance direto (BCB) | — | Não: exige autorização do BCB, sandbox incluído |
| Pluggy | R$ 2.500/mês | Não: sandbox grátis por 14 dias |
| Belvo | R$ 6.000/mês | Não |
| Tecnospeed | R$ 1.500 + R$ 540/mês | Não |
| Revendas de agregador | a partir de ~R$ 20/conexão | Não: relato não verificado, e adiciona intermediário |
| Bibliotecas não-oficiais | grátis | Não: engenharia reversa, quebra sozinha e viola os termos |
| **Arquivo CSV/OFX do banco** | **grátis** | **Sim** |

**Conclusão:** importar arquivo não é o plano B. É o único plano que deixa qualquer
pessoa usar de graça.

Sobra um módulo Open Finance legítimo e sem custo: as APIs da fase 1 são públicas e sem
autenticação — produtos, tarifas e taxas de cada instituição. Somadas às séries do SGS
do Banco Central, permitem corrigir valores por IPCA, comparar sobra de caixa com Selic
e CDI e mostrar quanto a tarifa do seu banco destoa das outras.

---

## 4. Módulos

| Módulo | Entrega | Quando |
|---|---|---|
| Importação | CSV do Nubank (crédito e débito) mapeado, mapeador de colunas para qualquer CSV, OFX, prévia e deduplicação | MVP |
| Categorização | Motor de regras por palavra-chave, primeira que casa vence; as 128 regras iniciais em JSON versionado; editor; fila de revisão; criar regra a partir de uma correção | MVP |
| Cartão de crédito | Fatura pelo ciclo de fechamento configurável, gasto por categoria, ranking de estabelecimentos, comparação entre meses, assinaturas recorrentes | MVP |
| Parcelas | Reconhece `3/10`, registra a compra inteira, projeta as parcelas futuras e mostra o comprometimento das próximas faturas | MVP |
| Painéis | Mês e ano, previsto contra realizado, quebra por categoria e por forma de pagamento | MVP |
| Metas e orçamento | Limite mensal por categoria, alerta ao aproximar do teto, projeção pelo ritmo de gasto | MVP |
| Conferência de DAS | Separação PF/PJ, RBT12, alíquota efetiva por anexo, Fator R e comparação com o valor cobrado | MVP |
| Dados públicos do BCB | Séries do SGS e APIs públicas da fase 1 do Open Finance | Depois do MVP |

O ciclo de fechamento está fixo no dia 5 no VBA. No Bolso vira configuração, porque cada
cartão fecha num dia.

---

## 5. Módulo de conferência de DAS

A fórmula do Simples Nacional é estável e pública:

```
alíquota efetiva = (RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12
DAS do mês       = receita do mês × alíquota efetiva
Fator R          = folha dos últimos 12 meses ÷ RBT12
```

Fator R maior ou igual a 28% leva o prestador de serviço para o Anexo III; abaixo disso
ele cai no Anexo V, que é mais caro. MEI paga valor fixo e não entra nessa conta.

O que muda com o tempo são as tabelas, não a fórmula. A reforma tributária entra em
transição de 2026 a 2033, com IBS e CBS recolhidos dentro do próprio DAS. Em 2026 nada
muda no valor pago por quem está no Simples, e o destaque de CBS e IBS nas notas só
passa a valer para essas empresas a partir de 2027.

**Consequência de projeto:** cada anexo é um JSON com ano de vigência, faixas, alíquotas
nominais e parcelas a deduzir. Atualizar para 2027 tem que ser adicionar um arquivo e um
teste, não caçar número solto no meio da lógica. Toda tela do módulo diz, em texto
visível, que o resultado é estimativa para conferência e não dispensa o contador.

---

## 6. Arquitetura

Local-first agora, com o armazenamento atrás de uma interface para que sincronização em
nuvem seja uma adição na v2 e não uma reescrita.

```
apps/web            React + Vite + TypeScript, publicado como site estático.
                    Vite em vez de Next porque não há servidor a servir.
        │
        ▼
packages/core       TypeScript puro, sem framework e sem dependência.
                    Categorização, parcelas, ciclo de fatura, deduplicação,
                    orçamento, previsto × realizado, cálculo do DAS.
                    Coberto por testes no Vitest. É a tradução do VBA.
        │
        ▼
portas e adaptadores
        armazenamento   IndexedDB (hoje) · API + Postgres (v2) · backup JSON
        entrada         CSV Nubank crédito · CSV Nubank débito ·
                        CSV genérico mapeável · OFX · agregador (opcional)
        dados públicos  BCB SGS · Open Finance fase 1
```

O núcleo não sabe que existe navegador, React ou banco de dados — e é por isso que ele é
inteiramente testável.

Em volta: GitHub Actions rodando lint, testes e publicação no Pages a cada push; licença
MIT; README que leva do clone ao app rodando em dois minutos; regras de categorização em
arquivo aberto para quem quiser contribuir com as do banco dele.

---

## 7. Plano do semestre

Sete sprints de duas semanas e uma semana de fechamento. Cada sprint entrega algo
utilizável, e o núcleo testável vem antes de qualquer tela.

| # | Sprint | Período | Entrega |
|---|---|---|---|
| 1 | Fundação | 08–19 set | Repositório, CI, modelo de dados e núcleo com testes: categorização, dedupe e ciclo de fatura |
| 2 | Importação | 22 set–03 out | Parsers do Nubank, mapeador de CSV genérico, prévia e deduplicação |
| 3 | Categorização | 06–17 out | Motor de regras com as 128 regras iniciais, editor e fila de revisão |
| 4 | Painéis | 20–31 out | Visão mensal e anual, quebras por categoria e forma de pagamento |
| 5 | Cartão e parcelas | 03–14 nov | Fatura por ciclo, parcelas projetadas e assinaturas recorrentes |
| 6 | Metas | 17–28 nov | Orçamento por categoria, alertas e projeção de ritmo |
| 7 | CNPJ | 01–12 dez | PF/PJ, RBT12, DAS por anexo com Fator R e comparador |
| 8 | Entrega | 15–19 dez | Publicação, guia de exportação por banco, vídeo da oficina e feedback |

OFX e os dados públicos do BCB entram como folga: se algum sprint fechar adiantado, eles
sobem; se apertar, ficam para depois da entrega sem comprometer o MVP.

---

## 8. Entregáveis de extensão

Público atendido: MEIs e pequenas PJs.

- **Guia de exportação por banco.** O passo em que todo mundo trava não é usar o app, é
  achar onde o banco esconde o botão de exportar extrato. Nubank, Itaú, Inter, Caixa, BB
  e Bradesco.
- **App publicado e gratuito**, sem cadastro e sem cobrança. Quem preferir não confiar no
  site hospedado clona o repositório e roda igual, porque é o mesmo código.
- **Oficina gravada** mostrando importar o primeiro extrato e ler o resultado.
- **Canal de feedback aberto** nas issues, com rótulos separando "meu banco não importa"
  de "erro de categorização".

---

## 9. Fora de escopo

- Substituir contador.
- Recomendação de investimento.
- Conexão com banco por biblioteca não-oficial ou engenharia reversa.
- Pedir senha de banco, em nenhuma hipótese, nem opcionalmente.
- Subir dado financeiro para servidor no MVP, nem anônimo, nem para telemetria.
- Multiusuário com login. Um app por pessoa, um navegador por pessoa.

---

## 10. Fontes

- [Open Finance Brasil — Como usar o Open Finance](https://openfinancebrasil.org.br/como-usar-o-open-finance/)
- [Área do Desenvolvedor — Lista de Participantes](https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/17377913/Lista+de+Participantes)
- [Pluggy — Planos e Preços](https://www.pluggy.ai/precos)
- [Portal de Dados Abertos do Banco Central](https://dadosabertos.bcb.gov.br/)
- [Simples Nacional — anexos, alíquotas e cálculo passo a passo](https://blog.cefis.com.br/tabela-do-simples-nacional-anexos-aliquotas-e-calculo-passo-a-passo/)
- [Simples Nacional na reforma tributária — transição 2026 a 2033](https://ospcontabilidade.com.br/blog/simples-nacional-reforma-tributaria-2026/)
