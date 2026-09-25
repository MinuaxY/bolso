# Oficina: roteiro

Roteiro para a apresentação gravada do Bolso. Cerca de dez minutos.

**Público:** MEIs e pequenas PJs, e qualquer pessoa que queira saber em que foi o
dinheiro do mês. Assume que a pessoa usa o aplicativo do banco no celular e
nunca exportou um extrato na vida.

**O que a pessoa precisa ter à mão:** o aplicativo do banco e um computador ou
celular com navegador. Nada mais — não há instalação, cadastro nem senha.

---

## Antes de gravar

- [ ] Abra o app numa **janela anônima** ou apague os dados antes, para a gravação
      começar do zero como começa para quem assiste.
- [ ] Prepare **um extrato anonimizado** para a demonstração. Nunca grave a tela
      com o seu extrato real: nome de quem te mandou Pix, CNPJ de cliente e valor
      de faturamento ficam no vídeo para sempre.
- [ ] Deixe o guia de exportação aberto noutra aba, caso alguém pergunte ao vivo.
- [ ] Teste o áudio. Vídeo de projeto acadêmico costuma morrer no som, não na
      imagem.

---

## Roteiro

### 1. O problema, em trinta segundos (0:00–0:30)

Mostre a tela do aplicativo do banco. Diga o que ele **não** responde:

> "O app do banco mostra o que entrou e o que saiu. Ele não me diz quanto das
> próximas faturas já está comprometido em parcelamento, nem me avisa da
> assinatura que eu esqueci que assinei. E se eu tenho CNPJ, ele não separa o que
> é meu do que é da empresa."

Não fale de tecnologia aqui. Fale do problema de quem assiste.

### 2. A promessa e o que a sustenta (0:30–1:30)

Abra <https://minuaxy.github.io/bolso/>. Sem cadastro, sem login, sem senha.

> "Isto aqui não é um site que guarda os seus dados. É um programa que roda dentro
> do seu navegador. O extrato que eu vou importar agora não sai desta máquina."

**Faça a demonstração que prova isso:** abra o DevTools na aba Rede, importe o
arquivo, e mostre que não houve requisição nenhuma. É o momento mais forte da
apresentação — a promessa deixa de ser promessa e vira algo que a pessoa
verifica.

### 3. Conseguir o arquivo (1:30–3:00)

Este é o passo em que as pessoas travam de verdade, então não corra.

Mostre no app do banco: extrato → período → exportar. Diga as três coisas que
importam:

- prefira **OFX** quando o banco oferecer;
- no Santander e no Sicoob o OFX aparece com o nome antigo, **"Money"**;
- a maioria dos bancos guarda só 60 a 90 dias — **exporte todo mês**.

### 4. Importar (3:00–4:30)

Arraste o arquivo. Pare na tela de prévia e explique o que ela está dizendo:

> "Ele reconheceu de que banco é, descobriu sozinho o formato da data e do valor,
> e está me mostrando o que vai criar antes de criar. Se eu importar o mesmo
> arquivo de novo, ele não duplica nada."

Confirme a importação.

### 5. O painel (4:30–6:00)

Gastei, recebi, sobrou. Para onde foi, por categoria. Como paguei.

Aponte o cartão de **transferências fora da soma** e explique por quê:

> "O pagamento da fatura sai da conta e entra no cartão. Se eu somasse os dois,
> o mesmo dinheiro apareceria duas vezes e a minha renda pareceria maior do que é."

Depois mostre o **comprometimento futuro**: quanto das próximas faturas já está
gasto em parcelamento. É a informação que o app do banco não dá.

### 6. A fila de revisão (6:00–7:00)

Mostre um lançamento que não foi reconhecido, escolha a categoria, e use o botão
que **cria a regra**.

> "Ele não acertou este aqui. Eu digo a categoria uma vez e crio a regra — da
> próxima importação em diante ele acerta sozinho."

### 7. Metas (7:00–8:00)

Defina um teto e volte ao painel. Mostre a projeção:

> "Não interessa só quanto eu já gastei. Interessa que, no ritmo de agora, o mês
> fecha acima do teto — e ainda estamos no dia 12, então dá para fazer algo."

### 8. O DAS, para quem tem CNPJ (8:00–9:30)

Preencha faturamento e folha. Mostre três coisas, nesta ordem:

1. o valor calculado e a **composição por tributo**, igual à da guia;
2. o campo de comparação com o que o contador cobrou;
3. quanto o **Fator R** está economizando por mês.

E diga o limite, com todas as letras:

> "Isto não substitui contador e não emite guia. Serve para você conferir — e para
> ter uma pergunta concreta a fazer quando o valor não bater."

### 9. Fechamento (9:30–10:00)

- O código é aberto e está no GitHub, com licença MIT.
- Qualquer pessoa pode rodar na própria máquina.
- Se o banco dela não importar, tem um lugar para avisar — e mostre onde.
- **Faça backup**: os dados vivem no navegador, e limpar o navegador apaga tudo.

---

## Perguntas que vão aparecer

**"Vocês veem meus dados?"**
Não existe "nós". Não há servidor. Os dados ficam no seu navegador, e a aba Rede
do DevTools mostra que nada sai.

**"E se eu trocar de computador?"**
Baixe o backup nos ajustes e restaure no outro. É um arquivo JSON.

**"Por que não conecta direto no banco, como o app X?"**
Porque só instituição autorizada pelo Banco Central acessa o Open Finance, e os
intermediários cobram a partir de R$ 540 por mês. O arquivo que o banco exporta
de graça é o único caminho que deixa qualquer pessoa usar isto sem pagar nada.

**"Funciona no banco tal?"**
Qualquer CSV funciona; se ele não reconhecer as colunas, ele pergunta. E OFX é
padrão, então funciona em qualquer banco que exporte OFX.

**"Posso usar para a minha empresa?"**
Pode. Marque no extrato o que é da empresa e o módulo do DAS passa a somar só
isso.

---

## Depois da oficina

- Deixe o link do repositório e o dos modelos de issue.
- Peça um retorno específico em vez de "o que acharam": **qual banco você usa e o
  arquivo dele importou?** É a pergunta cuja resposta melhora o projeto.
- Anote quem topou testar e em quanto tempo respondeu. Isso vira evidência de
  alcance no relatório da extensão.
