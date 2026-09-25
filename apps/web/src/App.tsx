import { competenciasDisponiveis } from '@bolso/core';
import type { RegraCategorizacao } from '@bolso/core';
import { useEffect, useMemo, useState } from 'react';

import { Ajustes } from './componentes/Ajustes.js';
import { Cartao } from './componentes/Cartao.js';
import { Extrato } from './componentes/Extrato.js';
import { Fiscal } from './componentes/Fiscal.js';
import { Importar } from './componentes/Importar.js';
import { Painel } from './componentes/Painel.js';
import { Revisao } from './componentes/Revisao.js';
import { useBolso } from './estado.js';
import { nomeCompetencia } from './formato.js';

type Aba = 'painel' | 'extrato' | 'cartao' | 'fiscal' | 'revisao' | 'importar' | 'ajustes';

const ABAS: readonly { id: Aba; nome: string }[] = [
  { id: 'painel', nome: 'Painel' },
  { id: 'extrato', nome: 'Extrato' },
  { id: 'cartao', nome: 'Cartão' },
  { id: 'fiscal', nome: 'DAS' },
  { id: 'revisao', nome: 'Revisão' },
  { id: 'importar', nome: 'Importar' },
  { id: 'ajustes', nome: 'Ajustes' },
];

function mesAtual(): string {
  const agora = new Date();
  return `${String(agora.getFullYear())}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
}

export function App() {
  const bolso = useBolso();
  const [aba, setAba] = useState<Aba>('painel');
  const [competencia, setCompetencia] = useState<string>(mesAtual);

  const competencias = useMemo(
    () => competenciasDisponiveis(bolso.lancamentos),
    [bolso.lancamentos],
  );

  // Ao carregar dados pela primeira vez, cai no mes mais recente que existe.
  useEffect(() => {
    if (competencias.length > 0 && !competencias.includes(competencia)) {
      setCompetencia(competencias[0] as string);
    }
  }, [competencias, competencia]);

  const pendentesDeRevisao = bolso.lancamentos.filter((l) => l.precisaRevisao === true).length;
  const vazio = !bolso.carregando && bolso.lancamentos.length === 0;

  async function criarRegra(regra: RegraCategorizacao): Promise<void> {
    await bolso.salvarAjustes({
      ...bolso.ajustes,
      regrasProprias: [regra, ...bolso.ajustes.regrasProprias],
    });
  }

  if (bolso.carregando) {
    return (
      <main className="centro">
        <p>Abrindo seus dados…</p>
      </main>
    );
  }

  if (bolso.erro !== null) {
    return (
      <main className="centro">
        <section className="cartao alerta">
          <h1>Não consegui abrir o armazenamento</h1>
          <p>{bolso.erro}</p>
          <p className="nota">
            O Bolso guarda tudo no seu navegador. Em janela anônima, ou com armazenamento de site
            bloqueado, ele não tem onde gravar.
          </p>
        </section>
      </main>
    );
  }

  return (
    <div className="aplicacao">
      <header className="topo">
        <div className="marca">
          <span className="marca-nome">Bolso</span>
          <span className="marca-nota">seus dados não saem daqui</span>
        </div>

        {competencias.length > 0 && (
          <label className="seletor-mes">
            Mês
            <select
              value={competencia}
              onChange={(evento) => {
                setCompetencia(evento.target.value);
              }}
            >
              {competencias.map((disponivel) => (
                <option key={disponivel} value={disponivel}>
                  {nomeCompetencia(disponivel)}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      <nav className="abas">
        {ABAS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={aba === item.id ? 'aba ativa' : 'aba'}
            onClick={() => {
              setAba(item.id);
            }}
          >
            {item.nome}
            {item.id === 'revisao' && pendentesDeRevisao > 0 && (
              <span className="contador">{pendentesDeRevisao}</span>
            )}
          </button>
        ))}
      </nav>

      <main>
        {vazio && aba !== 'importar' && aba !== 'ajustes' && aba !== 'fiscal' ? (
          <section className="cartao centro-texto">
            <h2>Comece importando um extrato</h2>
            <p>
              Exporte o CSV da sua conta ou da fatura do cartão no aplicativo do banco e traga o
              arquivo para cá. Ele é lido aqui dentro do navegador — nada é enviado para servidor
              nenhum.
            </p>
            <button
              type="button"
              className="principal"
              onClick={() => {
                setAba('importar');
              }}
            >
              Importar meu primeiro extrato
            </button>
          </section>
        ) : (
          <>
            {aba === 'painel' && (
              <Painel
                lancamentos={bolso.lancamentos}
                competencia={competencia}
                metas={bolso.ajustes.metas}
              />
            )}
            {aba === 'extrato' && (
              <Extrato
                lancamentos={bolso.lancamentos}
                competencia={competencia}
                regras={bolso.regras}
                aoAtualizar={bolso.atualizar}
                aoRemover={bolso.remover}
              />
            )}
            {aba === 'cartao' && (
              <Cartao
                lancamentos={bolso.lancamentos}
                competencia={competencia}
                diaFechamento={bolso.ajustes.diaFechamento}
              />
            )}
            {aba === 'fiscal' && (
              <Fiscal
                lancamentos={bolso.lancamentos}
                competencia={competencia}
                ajustes={bolso.ajustes}
                aoSalvar={bolso.salvarAjustes}
              />
            )}
            {aba === 'revisao' && (
              <Revisao
                lancamentos={bolso.lancamentos}
                regras={bolso.regras}
                aoAtualizar={bolso.atualizar}
                aoCriarRegra={criarRegra}
              />
            )}
            {aba === 'importar' && (
              <Importar
                lancamentosExistentes={bolso.lancamentos}
                regras={bolso.regras}
                diaFechamento={bolso.ajustes.diaFechamento}
                aoImportar={bolso.importar}
              />
            )}
            {aba === 'ajustes' && (
              <Ajustes
                ajustes={bolso.ajustes}
                lancamentos={bolso.lancamentos}
                regras={bolso.regras}
                aoSalvar={bolso.salvarAjustes}
                aoLimpar={bolso.limparTudo}
                aoRestaurar={bolso.substituirTudo}
              />
            )}
          </>
        )}
      </main>

      <footer className="rodape">
        <span>
          Beta. Os números conferem com o extrato, mas confira antes de tomar decisão com eles.
        </span>
        <a href="https://github.com/MinuaxY/bolso">código no GitHub</a>
      </footer>
    </div>
  );
}
