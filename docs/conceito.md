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

## 7. Estado e roadmap

Atualizado em 23/09/2026. O plano original previa sete sprints até dezembro; a
maior parte saiu em dois dias de trabalho concentrado, e a ordem do que sobrou
mudou por causa do que o dado real ensinou.

### Entregue — beta no ar

| | |
|---|---|
| Núcleo de domínio | Categorização por regras ordenadas, parcelas, ciclo de fatura, deduplicação, natureza de lançamento, relatórios |
| Leitores | OFX de conta e de cartão, CSV do Nubank, CSV da XP, CSV genérico com mapeamento de colunas |
| Aplicação | Importação com prévia, painel do mês, extrato editável, fatura do cartão, fila de revisão, backup JSON |
| Conferência de DAS | Simples e MEI, Fator R, RBT12 proporcional, composição por tributo, comparação com o valor cobrado, alíquota informada à mão |
| Atividade e CNAE | 17 atividades com anexo e fundamento legal; 1.332 subclasses do IBGE embarcadas para mostrar a descrição oficial do código |
| Pró-labore | INSS de 11%, IRRF com o redutor da Lei 15.270/2025, patronal do Anexo IV, e quanto o Fator R está valendo em dinheiro |
| Infraestrutura | CI com lint, tipos e cobertura; publicação automática no Pages; CSP com `connect-src 'none'` |

**Validação contra documento real.** O cálculo do DAS e o do pró-labore foram
conferidos contra uma guia e um DARF de 08/2026 de uma empresa de arquitetura
no Anexo III: R$ 456,59 e R$ 238,57, ao centavo, com a composição da guia
batendo linha por linha. Os leitores foram conferidos contra 775 lançamentos de
dois bancos em CSV e OFX, sem nenhum erro de leitura.

### Próximo — para fechar o beta

1. **Metas e orçamento por categoria**, com alerta de estouro e projeção pelo
   ritmo de gasto.
2. **Guia de exportação por banco** — o passo em que o usuário real trava.
3. **Marcação PF/PJ no extrato**, para o módulo fiscal somar só a receita da
   empresa em vez de toda receita do mês.
4. **Polimento**: estados vazios, revisão de textos, e guardar por competência o
   faturamento digitado à mão (hoje ele se perde ao recarregar a página).

### Depois do beta

**Outros DARF.** O do pró-labore já está pronto, que é o que uma PJ do Simples
encontra na prática — IRPJ, IPI, CSLL, COFINS, PIS e CPP estão dentro do DAS
pelo art. 13 da LC 123/2006. Ficam para depois, por utilidade:

| Variante | Quem paga | O que envolve |
|---|---|---|
| **Carnê-leão** (0190) | PF que recebe de outra PF, aluguel ou do exterior | Tabela progressiva mensal, deduções, livro-caixa |
| **Renda variável** (6015) | Quem vende ações, FIIs ou faz day trade | 15% e 20%, isenção até R$ 20 mil de venda em ações, e compensação de prejuízo acumulado — que exige guardar histórico e muda o modelo de dados |
| **IRPJ e CSLL no Lucro Presumido** | PJ fora do Simples | Só faz sentido se o projeto um dia atender empresa fora do Simples |

**Outros itens sem prazo:** cofre com senha (cifragem em repouso), séries do
Banco Central baixadas no CI para correção por IPCA, detecção de assinaturas
recorrentes, redistribuição do ISS quando ele bate no teto de 5%, e
empacotamento em Tauri para quem quiser ícone na área de trabalho.

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
