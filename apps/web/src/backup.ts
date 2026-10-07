/**
 * O formato do backup, num lugar so.
 *
 * Existia dentro da tela de ajustes, que era onde o unico botao de exportar
 * morava. Agora ha dois escritores — o botao e o espelho automatico — e eles
 * TEM que produzir o mesmo arquivo: um backup que so o botao sabe gerar e so
 * o botao sabe ler e uma armadilha esperando o dia da restauracao.
 */

import { validarRegras } from '@bolso/core';
import type { Lancamento } from '@bolso/core';

import type { Ajustes } from './armazenamento.js';

export interface Backup {
  readonly formato: 'bolso-backup';
  readonly versao: 1;
  readonly gerado: string;
  readonly ajustes: Ajustes;
  readonly lancamentos: readonly Lancamento[];
}

export function montarBackup(
  lancamentos: readonly Lancamento[],
  ajustes: Ajustes,
): Backup {
  return {
    formato: 'bolso-backup',
    versao: 1,
    gerado: new Date().toISOString(),
    ajustes,
    lancamentos,
  };
}

/** O backup serializado, como vai para o disco nos dois caminhos. */
export function serializarBackup(
  lancamentos: readonly Lancamento[],
  ajustes: Ajustes,
): string {
  return JSON.stringify(montarBackup(lancamentos, ajustes), null, 2);
}

export interface BackupLido {
  readonly lancamentos: readonly Lancamento[];
  readonly ajustes: Ajustes;
}

/**
 * Le e confere um arquivo de backup.
 *
 * Recusa cedo e com mensagem clara: restaurar backup e a operacao que a
 * pessoa faz no pior dia dela, e ai nenhuma surpresa e aceitavel.
 */
export function lerBackup(texto: string, ajustesAtuais: Ajustes): BackupLido {
  const conteudo = JSON.parse(texto) as Partial<Backup>;

  if (conteudo.formato !== 'bolso-backup' || !Array.isArray(conteudo.lancamentos)) {
    throw new Error('Este arquivo não é um backup do Bolso.');
  }

  const ajustesDoBackup = conteudo.ajustes ?? ajustesAtuais;
  validarRegras(ajustesDoBackup.regrasProprias ?? []);

  return {
    lancamentos: conteudo.lancamentos,
    ajustes: {
      diaFechamento: ajustesDoBackup.diaFechamento,
      regrasProprias: ajustesDoBackup.regrasProprias,
      // Backup gerado antes do modulo fiscal nao tem esses blocos.
      fiscal: ajustesDoBackup.fiscal ?? ajustesAtuais.fiscal,
      metas: ajustesDoBackup.metas ?? [],
    },
  };
}
