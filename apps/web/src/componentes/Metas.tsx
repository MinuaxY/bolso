import { avaliarMetas, totalizarMetas } from '@bolso/core';
import type { AvaliacaoMeta, Competencia, Lancamento, Meta } from '@bolso/core';
import { useMemo } from 'react';

import { formatarCentavos, formatarPercentual, nomeCompetencia, plural } from '../formato.js';

const ROTULO: Record<AvaliacaoMeta['situacao'], string> = {
  tranquilo: 'no ritmo',
  atencao: 'atenção',
  estourou: 'estourou',
};

function hojeISO(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${String(agora.getFullYear())}-${mes}-${dia}`;
}

/** O progresso de uma meta, com a projeção do fechamento quando ela existe. */
function LinhaMeta({ meta }: { meta: AvaliacaoMeta }) {
  const preenchido = Math.min(100, meta.percentual);
  const projetado =
    meta.projecaoCentavos === undefined
      ? null
      : Math.min(100, (meta.projecaoCentavos / meta.limiteCentavos) * 100);

  return (
    <li>
      <div className="barras-topo">
        <span className="barras-nome">{meta.categoria}</span>
        <span className="barras-valor num">
          {formatarCentavos(meta.gastoCentavos)}{' '}
          <span className="meta-teto">de {formatarCentavos(meta.limiteCentavos)}</span>
        </span>
      </div>

      <div className="barras-trilho">
        {projetado !== null && projetado > preenchido && (
          <div className="meta-projecao" style={{ width: `${String(projetado)}%` }} />
        )}
        <div
          className={`barras-preenchimento meta-${meta.situacao}`}
          style={{ width: `${String(preenchido)}%` }}
        />
      </div>

      <span className="barras-detalhe">
        <span className={`meta-selo meta-selo-${meta.situacao}`}>{ROTULO[meta.situacao]}</span>
        {meta.restanteCentavos >= 0
          ? ` restam ${formatarCentavos(meta.restanteCentavos)}`
          : ` passou ${formatarCentavos(-meta.restanteCentavos)}`}
        {meta.projecaoCentavos !== undefined && meta.diaDoMes !== undefined && (
          <>
            {' · '}
            no dia {meta.diaDoMes}, mantendo o ritmo, fecha em{' '}
            {formatarCentavos(meta.projecaoCentavos)}
          </>
        )}
      </span>
    </li>
  );
}

export function ResumoDeMetas({
  lancamentos,
  competencia,
  metas,
}: {
  lancamentos: readonly Lancamento[];
  competencia: Competencia;
  metas: readonly Meta[];
}) {
  const avaliacoes = useMemo(
    () => avaliarMetas(lancamentos, competencia, metas, hojeISO()),
    [lancamentos, competencia, metas],
  );

  if (avaliacoes.length === 0) return null;

  const total = totalizarMetas(avaliacoes);

  return (
    <section className="cartao">
      <h3>Metas de {nomeCompetencia(competencia)}</h3>
      <p className="nota">
        {formatarCentavos(total.gastoCentavos)} de {formatarCentavos(total.limiteCentavos)}{' '}
        orçados ({formatarPercentual((total.gastoCentavos / total.limiteCentavos) * 100, 0)})
        {total.estouradas > 0 &&
          ` · ${plural(total.estouradas, 'categoria estourou', 'categorias estouraram')}`}
      </p>
      <ul className="barras">
        {avaliacoes.map((meta) => (
          <LinhaMeta key={meta.categoria} meta={meta} />
        ))}
      </ul>
    </section>
  );
}

/** Edição dos tetos, que mora nos ajustes por ser coisa que se mexe pouco. */
export function EditorDeMetas({
  categorias,
  metas,
  aoMudar,
}: {
  categorias: readonly string[];
  metas: readonly Meta[];
  aoMudar: (metas: readonly Meta[]) => void;
}) {
  const porCategoria = new Map(metas.map((m) => [m.categoria, m.limiteCentavos]));

  function definir(categoria: string, texto: string): void {
    const limpo = texto.replace(/[^\d]/g, '');
    const centavos = limpo === '' ? 0 : Number(limpo) * 100;
    const outras = metas.filter((m) => m.categoria !== categoria);
    aoMudar(centavos > 0 ? [...outras, { categoria, limiteCentavos: centavos }] : outras);
  }

  return (
    <section className="cartao">
      <h2>Metas por categoria</h2>
      <p>
        Um teto mensal para as categorias que você quer segurar. Quem tem teto aparece no painel
        com a projeção de fechamento — que é o aviso que ainda dá tempo de usar.
      </p>
      <p className="nota">Deixe em branco a categoria que você não quer acompanhar.</p>

      <div className="metas-grade">
        {categorias.map((categoria) => (
          <label key={categoria} className="campo">
            {categoria}
            <input
              type="text"
              inputMode="numeric"
              placeholder="sem teto"
              value={
                porCategoria.get(categoria) === undefined
                  ? ''
                  : String((porCategoria.get(categoria) ?? 0) / 100)
              }
              onChange={(evento) => {
                definir(categoria, evento.target.value);
              }}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
