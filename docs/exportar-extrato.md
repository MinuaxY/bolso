# Como exportar o extrato do seu banco

O Bolso não se conecta ao seu banco — ele lê o arquivo que o banco já
disponibiliza de graça. Este guia mostra onde esse arquivo fica.

> **Exporte todo mês.** A maioria dos bancos guarda só os últimos 60 a 90 dias
> de extrato. O que passar disso, você não recupera depois.

---

## O que procurar, em qualquer banco

Antes dos passos de cada um, o padrão que se repete em todos:

1. Abra a tela de **extrato** (ou "movimentações", "lançamentos").
2. Escolha o **período**.
3. Procure **exportar**, **salvar**, **baixar** ou um ícone de compartilhar —
   costuma ficar no canto superior da tela.
4. Escolha o formato. **Prefira OFX.**

### Por que OFX e não CSV

O OFX foi feito para ser lido por programa: data em campo próprio, valor sempre
com ponto decimal, e um identificador único por transação — o que permite ao
Bolso saber que um lançamento já foi importado antes, sem chutar.

CSV funciona, e o Bolso lê os dois. Mas CSV não tem padrão: o mesmo banco
exporta com vírgula num mês e ponto e vírgula no outro, e abrir o arquivo no
Excel muda o conteúdo. Se o seu banco oferece os dois, escolha OFX.

### Não abra o arquivo no Excel antes de importar

Abrir e salvar um CSV no Excel em português reescreve o separador e o formato
de data. O Bolso detecta e lê assim mesmo, mas é trabalho a troco de nada. Se
quiser conferir o conteúdo, feche sem salvar.

---

## Nubank

### Conta

1. Abra o app e toque no seu saldo.
2. Toque no ícone de **exportar** no topo da tela de extrato.
3. Escolha o período e o formato — o Nubank oferece **OFX** e CSV.
4. O arquivo chega por e-mail ou vai para os downloads do celular.

O CSV da conta do Nubank traz uma coluna `Identificador` com um código único
por transação, o que dá a mesma precisão do OFX na hora de evitar duplicata.

### Cartão de crédito

1. Abra a fatura que você quer.
2. Procure **exportar fatura** no fim da tela.
3. O formato oferecido costuma ser CSV, com as colunas `date`, `title` e
   `amount`.

**Atenção à convenção de sinal:** na fatura do cartão do Nubank, compra vem
como valor positivo e pagamento como negativo. No OFX é o contrário. O Bolso já
sabe disso e trata cada arquivo do jeito certo.

---

## XP

### Conta

Extrato → escolher período → exportar em **OFX**.

### Cartão

A fatura sai em CSV com as colunas `Data`, `Estabelecimento`, `Portador`,
`Valor` e `Parcela`. O Bolso usa a coluna `Parcela` diretamente, em vez de
tentar adivinhar o parcelamento pela descrição.

---

## Outros bancos

Os caminhos abaixo valem para o **internet banking no computador**, onde a
exportação costuma existir mesmo quando o app do celular não a oferece. Menus
mudam de tempos em tempos — se não achar, procure por "exportar" na tela de
extrato.

| Banco | Caminho | Formato |
|---|---|---|
| **Banco do Brasil** | Conta Corrente → Extratos → período → Exportar | OFX |
| **Itaú** | Conta Corrente → Extrato → período → Exportar | OFX |
| **Bradesco** | Conta → Extrato Bancário → período → Exportar | OFX |
| **Caixa** | Minha Conta → Extrato → período → Exportar | OFX |
| **Santander** | Conta Corrente → Extrato → período → Exibir → Exportar | escolha "Money 2000 ou superior" |
| **Sicoob** | Conta → Consultas → Conta Corrente → período → Consultar → Salvar | "Formato OFX (Money em diante)" |
| **Inter, C6, PicPay, Mercado Pago, PagBank, Stone** | Tela de extrato → exportar ou compartilhar | OFX ou CSV, conforme o app |

No Santander e no Sicoob a opção de OFX aparece com o nome antigo do formato,
"Money" — é o mesmo arquivo.

---

## Meu banco não está aqui

O Bolso lê **qualquer CSV**. Se o arquivo do seu banco não for reconhecido
automaticamente, a tela de importação pergunta qual coluna é a data, qual é o
valor e qual é a descrição, e importa a partir daí.

Se funcionar, [abra uma issue](https://github.com/MinuaxY/bolso/issues) dizendo
qual banco e qual o cabeçalho do arquivo — assim o próximo a usar aquele banco
já encontra o reconhecimento pronto. Se não funcionar, abra a issue do mesmo
jeito: é exatamente o tipo de problema que o projeto quer receber.

**Nunca anexe seu extrato real numa issue.** Ele tem CPF, CNPJ, agência e conta
no meio das descrições. A primeira linha do arquivo — só o cabeçalho, sem
nenhuma transação — já basta para eu reconhecer o formato.
