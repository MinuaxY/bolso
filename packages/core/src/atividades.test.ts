import { describe, expect, it } from 'vitest';

import { ATIVIDADES, AVISO_ATIVIDADES, atividadePorCnae, buscarAtividades } from './atividades.js';

describe('tabela de atividades', () => {
  it('cobre os cinco anexos', () => {
    const anexos = new Set(ATIVIDADES.map((a) => a.anexo));
    expect([...anexos].sort()).toEqual(['I', 'II', 'III', 'IV', 'V']);
  });

  it('so o Anexo V oscila pelo Fator R', () => {
    // Quem esta no I, II, III fixo ou IV nao entra nessa conta.
    for (const atividade of ATIVIDADES) {
      if (atividade.fatorR) expect(atividade.anexo).toBe('V');
    }
  });

  it('toda atividade cita o fundamento legal', () => {
    for (const atividade of ATIVIDADES) {
      expect(atividade.fundamento, atividade.nome).toMatch(/LC 123\/2006/);
    }
  });

  it('avisa que a classificacao por CNAE e interpretacao, nao consulta oficial', () => {
    expect(AVISO_ATIVIDADES).toMatch(/nao existe tabela oficial/i);
  });
});

describe('atividadePorCnae', () => {
  it('aceita o CNAE escrito de qualquer jeito', () => {
    for (const escrito of ['6201-5/01', '62.01-5/01', '6201501', '62.01']) {
      expect(atividadePorCnae(escrito)?.id, escrito).toBe('ti');
    }
  });

  it('a regra mais especifica vence a mais geral', () => {
    // 69.20 e contabilidade, Anexo III fixo; 69.11 e advocacia, Anexo IV.
    expect(atividadePorCnae('6920-6/01')?.anexo).toBe('III');
    expect(atividadePorCnae('6911-7/01')?.anexo).toBe('IV');
  });

  it('reconhece os casos mais comuns de cada anexo', () => {
    expect(atividadePorCnae('4781-4/00')?.anexo).toBe('I'); // loja de roupas
    expect(atividadePorCnae('1412-6/01')?.anexo).toBe('II'); // confecção
    expect(atividadePorCnae('4321-5/00')?.anexo).toBe('IV'); // instalação elétrica
    expect(atividadePorCnae('8630-5/03')?.anexo).toBe('V'); // consultório médico
  });

  it('atividade de servico intelectual cai no Anexo V com Fator R', () => {
    const ti = atividadePorCnae('6201-5/01');
    expect(ti?.fatorR).toBe(true);
    expect(ti?.anexo).toBe('V');
  });

  it('nao chuta quando nao reconhece', () => {
    expect(atividadePorCnae('9999-9/99')).toBeUndefined();
    expect(atividadePorCnae('')).toBeUndefined();
    expect(atividadePorCnae('6')).toBeUndefined();
  });
});

describe('buscarAtividades', () => {
  it('acha pelo que a pessoa faz, sem saber o codigo', () => {
    expect(buscarAtividades('software')[0]?.id).toBe('ti');
    expect(buscarAtividades('cabeleireiro')[0]?.id).toBe('beleza');
    expect(buscarAtividades('advocacia')[0]?.id).toBe('advocacia');
  });

  it('ignora acento e caixa', () => {
    expect(buscarAtividades('CONSTRUÇÃO')[0]?.anexo).toBe('IV');
  });

  it('entende CNAE digitado no campo de busca', () => {
    expect(buscarAtividades('6201-5/01')).toHaveLength(1);
  });

  it('sem termo, devolve a lista inteira', () => {
    expect(buscarAtividades('')).toHaveLength(ATIVIDADES.length);
  });

  it('devolve vazio em vez de chutar quando nada casa', () => {
    expect(buscarAtividades('mineracao de asteroides')).toHaveLength(0);
  });
});
