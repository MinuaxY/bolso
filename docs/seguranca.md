# Segurança e modelo de ameaças

Este documento existe porque o Bolso lida com extrato bancário. Ele descreve o que o
projeto guarda, o que ele nunca faz, contra o que ele protege e — igualmente importante
— contra o que ele **não** protege.

Última revisão: 03/09/2026.

---

## 1. O que o Bolso guarda, e onde

Tudo que você importa fica no **IndexedDB do seu próprio navegador**, na sua máquina.
Não existe conta, não existe login, não existe banco de dados remoto e não existe
servidor de aplicação. O que o GitHub hospeda são arquivos estáticos: HTML, CSS e
JavaScript, iguais para todo mundo.

Consequência direta: **não há um lugar central de onde o extrato de todos os usuários
possa vazar**, porque esse lugar não existe. Um invasor que comprometesse a hospedagem
poderia alterar o app distribuído, mas não encontraria dado nenhum armazenado lá.

## 2. O que o Bolso nunca faz

- Não envia lançamento, saldo, valor ou nome de estabelecimento para lugar nenhum.
- Não tem telemetria, analytics, pixel ou log remoto — nem anônimo.
- Não pede senha de banco, nem em campo opcional.
- Não carrega script, fonte ou imagem de terceiro em tempo de execução.

A política de segurança de conteúdo da página declara `connect-src 'none'`. Isso
significa que o **navegador** bloqueia qualquer tentativa de saída de dados, mesmo que
um código malicioso já esteja rodando. Não é promessa de quem escreveu o app: é o
navegador impedindo.

Por isso as séries públicas do Banco Central (IPCA, Selic, CDI) são baixadas **no CI**,
uma vez por mês, e distribuídas como JSON estático junto do app. O navegador do usuário
nunca faz requisição a lugar nenhum.

**Como conferir sem confiar em nós:** abra o DevTools, aba Rede, e use o app. Não há
requisição depois do carregamento inicial.

## 3. Ameaças e defesas

| Ameaça | Defesa |
|---|---|
| Vazamento de banco de dados do serviço | Não existe banco de dados nem serviço |
| Exfiltração por dependência maliciosa (npm comprometido) | `connect-src 'none'`; núcleo sem dependência; `npm ci` com lockfile; Dependabot; Actions fixadas por SHA |
| Script de terceiro na página | Nenhum. Fontes e ícones são empacotados junto |
| Interceptação em trânsito | Não há trânsito. O carregamento do app é HTTPS obrigatório |
| Outra pessoa na mesma máquina | Cofre opcional com senha (sprint 6) e botão de apagar tudo |
| Outra página da mesma origem | Ver seção 4 |
| Perda de dados por limpeza do navegador | `navigator.storage.persist()` e backup export/import |

## 4. A origem compartilhada do GitHub Pages — risco aceito

O GitHub Pages serve todos os projetos de uma conta no mesmo host. `minuaxy.github.io/bolso`
e `minuaxy.github.io/portfolio` são a **mesma origem** para o navegador: caminho não
isola armazenamento. Qualquer página publicada nessa conta consegue, tecnicamente, ler o
IndexedDB do Bolso.

**Decisão de 02/09/2026:** manter o Bolso em `minuaxy.github.io/bolso`, aceitando o
risco, com três condições.

1. **Regra permanente:** enquanto o Bolso dividir origem com outros projetos da conta,
   nenhum deles pode carregar script de terceiro — CDN, analytics, widget, tag manager.
   Auditoria feita em 02/09/2026: o `portfolio` não carrega nenhum. Todas as bibliotecas
   estão em cópia local; o Google Fonts entra como folha de estilo, que não executa
   código; o mapa é um `iframe`, que é origem separada.
2. **O cofre com senha é a defesa desta escolha.** Com os dados cifrados em repouso, uma
   página vizinha lê texto cifrado. A camada de armazenamento nasce com o ponto de
   cifragem na sprint 1, ainda desligado.
3. **Mudar de endereço custa os dados de quem já usa.** IndexedDB é preso à origem: uma
   futura migração para domínio próprio deixa os dados órfãos. O backup export/import
   precisa existir e estar testado **antes** de qualquer mudança de endereço.

**Atualização de 03/09/2026:** o `portfolio` foi tornado privado a pedido do autor e
deixou de publicar. `minuaxy.github.io` não serve mais nada, e o Bolso será o único
ocupante dessa origem quando subir. O risco desta seção está, hoje, sem ninguém para
exercê-lo — mas a condição 1 continua valendo para qualquer projeto futuro publicado
nesta conta, que é exatamente por que ela está escrita aqui em vez de lembrada.

## 5. O que o Bolso não protege

Ser honesto sobre o limite é parte da segurança.

- **Máquina comprometida.** Se há malware ou keylogger no computador, nenhum app que
  roda nesse computador ajuda.
- **Navegador ou extensão maliciosa.** Extensão com permissão de leitura na página
  enxerga o que a página enxerga.
- **Quem tem acesso físico ao seu perfil de navegador**, enquanto o cofre não estiver
  ligado.
- **O arquivo de backup.** O export sai em JSON legível. Guarde-o como guardaria o
  extrato em PDF.
- **Sua conta do provedor de hospedagem.** Quem controla o repositório controla o código
  distribuído. Por isso: 2FA obrigatório na conta e nenhuma Action com permissão de
  escrita desnecessária.

## 6. Dados de teste

Nunca versione extrato real. O `.gitignore` ignora `*.csv` e `*.ofx` antes de qualquer
outra coisa, de propósito. Os arquivos usados em teste são escritos à mão, com valores e
estabelecimentos fictícios, e ficam em caminhos com exceção explícita no `.gitignore`.
Extrato de banco carrega CPF, CNPJ, agência e conta no meio da descrição.

## 7. Reportar um problema

Veja [SECURITY.md](../SECURITY.md).
