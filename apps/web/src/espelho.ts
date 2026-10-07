/**
 * O espelho: um arquivo no disco que acompanha o IndexedDB.
 *
 * O Bolso guarda tudo no navegador, e isso resolve privacidade mas nao
 * resolve durabilidade. "Limpar dados de navegacao" apaga o historico
 * financeiro inteiro, e formatar a maquina tambem. Backup manual existe desde
 * o comeco — e depende de a pessoa lembrar, que e justamente o que ninguem
 * faz.
 *
 * O espelho resolve escolhendo o arquivo UMA vez: a pessoa aponta, por
 * exemplo, uma pasta do OneDrive, e dali em diante o app reescreve aquele
 * arquivo a cada alteracao. Quem sincroniza e versiona a pasta e o servico de
 * nuvem dela, nao nos — continuamos sem servidor e sem conta.
 *
 * ISTO NAO E REQUISICAO DE REDE. A File System Access API escreve num arquivo
 * local atraves de uma permissao que a propria pessoa concede no seletor do
 * sistema. O `connect-src 'none'` da politica de seguranca continua valendo
 * inteiro, e continua sendo verdade que nenhum dado sai da maquina por conta
 * do app.
 *
 * Limite honesto: so Chrome e Edge no desktop implementam a API. Em Firefox e
 * Safari `espelhoSuportado()` devolve falso e a tela oferece o backup manual,
 * que continua existindo para todo mundo.
 */

/* A API ainda nao esta no lib.dom do TypeScript. Declarado aqui o minimo que
   o app usa, em vez de trazer um pacote de tipos inteiro. */
type ModoPermissao = 'read' | 'readwrite';
type EstadoPermissao = 'granted' | 'denied' | 'prompt';

interface PermissaoDeArquivo {
  queryPermission?: (opcoes: { mode: ModoPermissao }) => Promise<EstadoPermissao>;
  requestPermission?: (opcoes: { mode: ModoPermissao }) => Promise<EstadoPermissao>;
}

type Arquivo = FileSystemFileHandle & PermissaoDeArquivo;

interface OpcoesSeletor {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}

interface JanelaComSeletor {
  showSaveFilePicker?: (opcoes?: OpcoesSeletor) => Promise<Arquivo>;
}

export type Permissao = 'concedida' | 'precisa-autorizar' | 'negada';

export function espelhoSuportado(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as JanelaComSeletor).showSaveFilePicker === 'function'
  );
}

const TIPO = {
  description: 'Backup do Bolso',
  accept: { 'application/json': ['.json'] },
};

/**
 * Abre o seletor do sistema para a pessoa escolher onde o espelho vai morar.
 *
 * Devolve `null` quando ela desiste — desistir nao e erro, e nao deve virar
 * mensagem vermelha na tela.
 */
export async function escolherEspelho(): Promise<Arquivo | null> {
  const seletor = (window as unknown as JanelaComSeletor).showSaveFilePicker;
  if (seletor === undefined) return null;

  try {
    return await seletor({ suggestedName: 'bolso-backup.json', types: [TIPO] });
  } catch (causa) {
    // `AbortError` e a pessoa fechando o seletor. Qualquer outra coisa sobe.
    if (causa instanceof DOMException && causa.name === 'AbortError') return null;
    throw causa;
  }
}

/**
 * Em que pe esta a permissao de escrever naquele arquivo.
 *
 * Depois que o navegador reinicia, a permissao volta para `prompt`: o Chrome
 * exige um gesto da pessoa para reconceder. Por isso existe
 * `precisa-autorizar` em vez de so um booleano — a tela precisa saber a
 * diferenca entre "nao posso gravar" e "nao posso gravar AINDA", e pedir um
 * clique em vez de falhar calada.
 */
export async function permissaoDoEspelho(arquivo: Arquivo): Promise<Permissao> {
  if (arquivo.queryPermission === undefined) return 'concedida';
  try {
    const estado = await arquivo.queryPermission({ mode: 'readwrite' });
    if (estado === 'granted') return 'concedida';
    return estado === 'denied' ? 'negada' : 'precisa-autorizar';
  } catch {
    return 'precisa-autorizar';
  }
}

/** Pede a permissao de volta. Precisa ser chamado de dentro de um clique. */
export async function autorizarEspelho(arquivo: Arquivo): Promise<Permissao> {
  if (arquivo.requestPermission === undefined) return 'concedida';
  try {
    const estado = await arquivo.requestPermission({ mode: 'readwrite' });
    if (estado === 'granted') return 'concedida';
    return estado === 'denied' ? 'negada' : 'precisa-autorizar';
  } catch {
    return 'negada';
  }
}

/**
 * Reescreve o arquivo inteiro.
 *
 * Inteiro, e nao em pedacos: o backup e pequeno — alguns milhares de linhas
 * de JSON — e escrever tudo de uma vez significa que o arquivo no disco ou e
 * a versao velha inteira ou a nova inteira, nunca metade de cada. Num arquivo
 * que existe para o dia em que tudo deu errado, isso vale mais do que
 * desempenho.
 */
export async function gravarNoEspelho(arquivo: Arquivo, conteudo: string): Promise<void> {
  const fluxo = await arquivo.createWritable();
  try {
    await fluxo.write(conteudo);
  } finally {
    await fluxo.close();
  }
}

/**
 * Traduz a falha para algo que a pessoa possa agir.
 *
 * O navegador fala em ingles e em termos de API — "Failed to execute 'write'
 * on 'FileSystemWritableFileStream'" nao diz a ninguem o que fazer. As tres
 * causas reais sao o arquivo ter sumido, a permissao ter caido e o disco ter
 * acabado, e cada uma tem uma acao diferente. O texto tecnico vai junto no
 * fim, porque quem souber ler vai querer ver.
 */
export function explicarFalha(causa: unknown): string {
  const detalhe = causa instanceof Error ? causa.message : String(causa);
  const nome = causa instanceof DOMException ? causa.name : '';

  if (nome === 'NotFoundError') {
    return `O arquivo de backup não está mais onde estava — movido, renomeado ou apagado. Escolha o arquivo de novo. (${detalhe})`;
  }
  if (nome === 'NotAllowedError' || nome === 'SecurityError') {
    return `O navegador não está deixando gravar nesse arquivo agora. Autorize de novo, ou escolha outro. (${detalhe})`;
  }
  if (nome === 'QuotaExceededError') {
    return `Não há espaço em disco para gravar o backup. (${detalhe})`;
  }
  return `Não consegui gravar no arquivo. (${detalhe})`;
}

export type { Arquivo as ArquivoEspelho };
