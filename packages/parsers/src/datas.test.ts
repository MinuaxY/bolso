import { describe, expect, it } from 'vitest';

import { analisarData, detectarFormatoData } from './datas.js';

describe('analisarData', () => {
  it('le o formato ISO do extrato de cartao', () => {
    expect(analisarData('2026-06-02', 'iso')).toBe('2026-06-02');
  });

  it('le o formato brasileiro que o Excel deixa para tras', () => {
    expect(analisarData('03/03/2026', 'brasileiro')).toBe('2026-03-03');
    expect(analisarData('3/3/2026', 'brasileiro')).toBe('2026-03-03');
  });

  it('aceita ponto e hifen como separador do formato brasileiro', () => {
    expect(analisarData('15.07.2026', 'brasileiro')).toBe('2026-07-15');
    expect(analisarData('15-07-2026', 'brasileiro')).toBe('2026-07-15');
  });

  it('completa ano de dois digitos no seculo certo', () => {
    // Extrato de banco nao tem data de 1926.
    expect(analisarData('15/07/26', 'brasileiro')).toBe('2026-07-15');
  });

  it('ignora hora sobrando depois da data', () => {
    expect(analisarData('2026-06-02 13:45:00', 'iso')).toBe('2026-06-02');
    expect(analisarData('02/06/2026 13:45', 'brasileiro')).toBe('2026-06-02');
  });

  it('recusa data que nao existe em vez de deslizar para o mes seguinte', () => {
    // `new Date(2026, 1, 30)` viraria 2 de marco calado.
    expect(analisarData('2026-02-30', 'iso')).toBeNull();
    expect(analisarData('30/02/2026', 'brasileiro')).toBeNull();
  });

  it('recusa texto que nao e data', () => {
    expect(analisarData('', 'iso')).toBeNull();
    expect(analisarData('Total do mes', 'brasileiro')).toBeNull();
  });

  it('nao le formato brasileiro como ISO', () => {
    expect(analisarData('03/03/2026', 'iso')).toBeNull();
  });
});

describe('detectarFormatoData', () => {
  it('reconhece o arquivo em ISO', () => {
    expect(detectarFormatoData(['2026-06-02', '2026-06-01'])).toBe('iso');
  });

  it('reconhece o arquivo em formato brasileiro', () => {
    expect(detectarFormatoData(['03/03/2026', '05/03/2026'])).toBe('brasileiro');
  });

  it('assume brasileiro quando nao ha pista, que e o caso dos bancos daqui', () => {
    expect(detectarFormatoData([])).toBe('brasileiro');
    expect(detectarFormatoData(['', '  '])).toBe('brasileiro');
  });
});
