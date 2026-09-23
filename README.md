# Bolso

Controle financeiro que roda no seu navegador. Você importa o extrato que o seu banco
já exporta — CSV ou OFX — e os dados ficam na sua máquina. Nada é enviado para servidor
nenhum, porque não existe servidor.

> **Beta no ar: <https://minuaxy.github.io/bolso/>**
>
> Abra e use — não tem cadastro, não tem login, não tem servidor. O planejamento
> completo está em [`docs/conceito.md`](docs/conceito.md).

## Para quem

Pessoas que querem saber em que foi o dinheiro do mês, e quem tem CNPJ no Simples
Nacional e quer conferir o DAS antes de pagar.

## Por que existe

Aplicativos de banco mostram o que entrou e o que saiu. Eles não mostram quanto das
próximas faturas já está comprometido por parcelamento, não avisam da assinatura que
você esqueceu que assinou, não separam pessoa física de jurídica e não conferem a conta
do contador.

Planilha resolve isso — este projeto nasce de uma, com 128 regras de categorização e
umas setecentas linhas de VBA — mas planilha não se instala no computador de outra
pessoa. O Bolso é essa planilha traduzida para algo que qualquer um consegue usar.

## Princípios

**1. Os dados ficam com você.** Tudo é gravado no IndexedDB do próprio navegador.
Extrato bancário é dado sensível, e não subir isso para lugar nenhum não é limitação
técnica — é a proposta.

**2. Zero configuração.** Abra o endereço e use. Quem preferir rodar na própria máquina
clona e dá dois comandos. Nenhuma chave de API, nenhum cadastro, nenhum contêiner.

**3. Arquivo em vez de API.** O Open Finance só é acessível a instituições autorizadas
pelo Banco Central — inclusive no sandbox — e os agregadores cobram de R$ 540 a
R$ 6.000 por mês. O arquivo que o banco exporta de graça é o único caminho que deixa
qualquer pessoa usar isto sem pagar nada.

## O que vai fazer

| Módulo | O que entrega |
|---|---|
| Importação | OFX de qualquer banco, CSV do Nubank e da XP já mapeados, mapeador para qualquer outro CSV, com prévia e deduplicação |
| Categorização | Motor de regras por palavra-chave, editável, com fila de revisão para o que não casar |
| Cartão de crédito | Fatura por ciclo de fechamento, gasto por categoria, assinaturas recorrentes |
| Parcelas | Detecta `3/10`, projeta as parcelas futuras e mostra o quanto já está comprometido |
| Painéis | Mês e ano, previsto contra realizado, por categoria e por forma de pagamento |
| Metas | Limite por categoria, alerta de estouro e projeção pelo ritmo de gasto |
| Conferência de DAS | RBT12, alíquota efetiva, Fator R e comparação com o valor cobrado |

## O que não vai fazer

- Substituir contador. O módulo fiscal calcula para conferência e diz isso na tela.
- Recomendar investimento.
- Pedir a senha do seu banco, em nenhuma hipótese.
- Conectar em banco por biblioteca não-oficial ou engenharia reversa.
- Subir dado financeiro para servidor — nem anônimo, nem para telemetria.

## Como rodar na sua máquina

```bash
npm install
npm run dev -w @bolso/web
```

Abre em <http://localhost:5173>. Para rodar a verificação completa — lint, tipos e
testes com cobertura, o mesmo que a esteira do GitHub roda:

```bash
npm run verificar
```

## Stack

React + Vite + TypeScript no navegador, núcleo de domínio em TypeScript puro sem
framework e coberto por testes, armazenamento em IndexedDB atrás de uma interface.
Publicação estática no GitHub Pages.

Três pacotes: `packages/core` tem o domínio em TypeScript puro, sem dependência
nenhuma; `packages/parsers` lê os arquivos de banco; `apps/web` é a interface. As
decisões de código estão em [`docs/convencoes.md`](docs/convencoes.md).

Validado contra 20 extratos reais de dois bancos, em CSV e OFX: 758 linhas lidas, zero
erros de leitura, quatro dialetos diferentes do mesmo banco reconhecidos, 73%
categorizado automaticamente. O mesmo extrato exportado nos dois formatos produz
resultado idêntico e não duplica na importação.

## Projeto de extensão

Este repositório é o projeto de extensão de Engenharia de Software do segundo semestre
de 2026. Além do código, o projeto entrega um guia de como exportar o extrato em cada
banco, uma oficina gravada e um canal aberto de feedback pelas issues. O público
atendido são MEIs e pequenas PJs.

## Licença

MIT. Veja [LICENSE](LICENSE).
