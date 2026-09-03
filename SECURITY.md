# Política de segurança

## Reportar uma vulnerabilidade

Use o **Private vulnerability reporting** do GitHub, em
[Security → Report a vulnerability](https://github.com/MinuaxY/bolso/security/advisories/new).
O relato fica privado entre você e os mantenedores até haver correção.

Por favor, **não** abra issue pública para falha de segurança.

Resposta esperada em até 7 dias. Este é um projeto acadêmico mantido por uma pessoa —
não há SLA, mas todo relato é lido.

## O que é vulnerabilidade neste projeto

O Bolso não tem servidor nem contas. O que importa aqui é tudo que possa fazer dado
financeiro sair do navegador de quem usa, ou que possa ser lido por quem não deveria:

- qualquer caminho que resulte em requisição de rede carregando dado do usuário;
- XSS ou injeção que permita ler o armazenamento local;
- dependência comprometida na cadeia de build;
- falha na cifragem do cofre, quando ele existir;
- vazamento de dado em mensagem de erro, log de console ou arquivo de export.

Erro de cálculo — categorização errada, DAS divergente, parcela mal detectada — não é
vulnerabilidade. Abra uma issue normal, que é igualmente bem-vinda.

## Escopo

Este repositório e a versão publicada em `minuaxy.github.io/bolso`.

O modelo de ameaças completo, incluindo o que o projeto explicitamente **não** protege,
está em [docs/seguranca.md](docs/seguranca.md).
