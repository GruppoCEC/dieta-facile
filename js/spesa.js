// ==========================================================================
// spesa.js — scheda "Spesa": lista unica generata dai piani di tutte le persone
// ==========================================================================

import { GIORNI, SLOT_PRINCIPALI, leggiExtra, impostaSpuntata, azzeraSpuntate, meseDellaSettimana } from './stato.js';
import { trovaOpzione, trovaCarbo, trovaSecondo } from './dati.js';
import { quantitaCarbo, formattaQuantita, maiuscola, varianteScelta, ingredientiEffettivi, quantitaVerdura } from './vincoli.js';
import { conEmoji } from './emoji.js';

/**
 * Calcola la lista della spesa sommando i piani di tutte le persone.
 * Restituisce { reparti: [{ id, nome, voci }], verdure: [{ nome, pasti }], pastiVerduraGenerica, pastiTotali }
 * Ogni voce: { chiave, nome, q, u, porzioni, perPersona: { p1: n } }
 */
export function calcolaSpesa(dieta, stato) {
  const somme = new Map();
  const verdure = new Map(); // verdura scelta → n. pasti
  let pastiVerduraGenerica = 0;
  let pastiTotali = 0;

  function aggiungi(ing, personaId, q = ing.q) {
    const chiave = `${ing.nome}|${ing.u}`;
    const voce = somme.get(chiave) || { chiave, nome: ing.nome, q: 0, u: ing.u, reparto: ing.reparto, porzioni: 0, perPersona: {} };
    voce.q += q;
    voce.porzioni += 1;
    voce.perPersona[personaId] = (voce.perPersona[personaId] || 0) + 1;
    somme.set(chiave, voce);
  }

  for (const persona of stato.persone) {
    const piano = stato.piani[persona.id];
    if (!piano) continue;

    for (const giorno of GIORNI) {
      for (const s of dieta.slot) {
        const scelta = piano.scelte[giorno][s.id];
        const extra = leggiExtra(piano, giorno, s.id);

        if (SLOT_PRINCIPALI.includes(s.id)) {
          const carbo = trovaCarbo(dieta, s.id, scelta.carbo);
          const secondo = trovaSecondo(dieta, s.id, scelta.secondo);
          if (!carbo && !secondo) continue;
          pastiTotali++;
          if (secondo && secondo.categoria === 'libero') continue;

          if (extra.verdura && extra.verdura.length) {
            for (const v of extra.verdura) verdure.set(v, (verdure.get(v) || 0) + 1);
          } else {
            pastiVerduraGenerica++;
          }
          if (carbo) {
            const qc = quantitaCarbo(carbo, secondo);
            const vc = varianteScelta(carbo, extra, 'carbo');
            aggiungi({ nome: (vc ? vc.nome : carbo.nome).replace(/ \(.*\)$/, ''), u: carbo.u, reparto: carbo.reparto }, persona.id, qc.q);
          }
          if (secondo) {
            const vs = varianteScelta(secondo, extra, 'secondo');
            for (const ing of ingredientiEffettivi(secondo, vs)) aggiungi(ing, persona.id);
          }
          aggiungi(dieta[s.id].olio, persona.id);
        } else {
          const opz = trovaOpzione(dieta, s.id, scelta);
          if (!opz) continue;
          pastiTotali++;
          const vo = varianteScelta(opz, extra, null);
          for (const ing of ingredientiEffettivi(opz, vo)) {
            if (ing.tipo === 'frutta' && extra.frutta) {
              // frutto specifico al posto di "frutta di stagione"
              aggiungi({ nome: maiuscola(extra.frutta), u: ing.u, reparto: ing.reparto }, persona.id, ing.q);
            } else {
              aggiungi(ing, persona.id);
            }
          }
        }
      }
    }
  }

  for (const v of somme.values()) {
    v.q = v.u === 'pz' ? Math.ceil(v.q - 1e-9) : Math.round(v.q);
  }

  const reparti = dieta.reparti.map(r => ({
    id: r.id,
    nome: r.nome,
    voci: [...somme.values()].filter(v => v.reparto === r.id).sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
  })).filter(r => r.voci.length > 0);

  const listaVerdure = [...verdure.entries()]
    .map(([nome, pasti]) => ({ nome, pasti }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));

  return { reparti, verdure: listaVerdure, pastiVerduraGenerica, pastiTotali };
}

/** ctx = { dieta, stagioni, stato, salva() } */
export function montaSpesa(contenitore, ctx) {
  function disegna() {
    const { dieta, stato } = ctx;
    contenitore.innerHTML = '';
    const spesa = calcolaSpesa(dieta, stato);
    const piuPersone = stato.persone.length > 1;

    if (spesa.pastiTotali === 0) {
      contenitore.appendChild(el('p', 'segnaposto', 'Compila prima qualche pasto nella scheda Settimana: la lista della spesa si genera da sola.'));
      contenitore.appendChild(disegnaStagione());
      return;
    }

    const chi = piuPersone ? ` per ${stato.persone.map(p => p.nome).join(' e ')}` : '';
    contenitore.appendChild(el('p', 'spesa-intro', `Ingredienti per ${spesa.pastiTotali} pasti pianificati${chi}. Quantità a crudo, sommate su tutta la settimana.`));

    // Verdure
    if (spesa.verdure.length || spesa.pastiVerduraGenerica) {
      const qv = quantitaVerdura(dieta);
      contenitore.appendChild(el('h3', 'reparto-titolo', `Verdura (${qv})`));
      const lista = document.createElement('ul');
      lista.className = 'lista-spesa';
      for (const v of spesa.verdure) {
        lista.appendChild(disegnaVoce({ chiave: `verdura|${v.nome}`, nome: maiuscola(v.nome), testoQ: `per ${v.pasti} ${v.pasti === 1 ? 'pasto' : 'pasti'}, ${qv}` }));
      }
      if (spesa.pastiVerduraGenerica) {
        lista.appendChild(disegnaVoce({ chiave: 'verdura|generica', nome: 'Verdura di stagione (non specificata)', testoQ: `per ${spesa.pastiVerduraGenerica} ${spesa.pastiVerduraGenerica === 1 ? 'pasto' : 'pasti'}, ${qv}` }));
      }
      contenitore.appendChild(lista);
    }

    for (const reparto of spesa.reparti) {
      contenitore.appendChild(el('h3', 'reparto-titolo', reparto.nome));
      const lista = document.createElement('ul');
      lista.className = 'lista-spesa';
      for (const voce of reparto.voci) {
        const quantita = voce.u === 'pz' ? `${voce.q} ${voce.q === 1 ? 'pezzo' : 'pezzi'}` : formattaQuantita(voce.q, voce.u);
        let testoQ = quantita;
        if (voce.porzioni > 1) {
          testoQ += ` · ${voce.porzioni} porzioni`;
          if (piuPersone) {
            const dettaglio = stato.persone.filter(p => voce.perPersona[p.id]).map(p => `${p.nome} ${voce.perPersona[p.id]}`).join(' · ');
            testoQ += ` (${dettaglio})`;
          }
        }
        lista.appendChild(disegnaVoce({ chiave: voce.chiave, nome: voce.nome, testoQ }));
      }
      contenitore.appendChild(lista);
    }

    const azioni = document.createElement('div');
    azioni.className = 'azioni';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pulsante';
    b.textContent = 'Togli tutte le spunte';
    b.addEventListener('click', () => { azzeraSpuntate(ctx.stato); ctx.salva(); disegna(); });
    azioni.appendChild(b);
    contenitore.appendChild(azioni);

    contenitore.appendChild(disegnaStagione());
  }

  function disegnaStagione() {
    const mese = ctx.stagioni.mesi[String(meseDellaSettimana(ctx.stato.settimanaDel))];
    const box = document.createElement('div');
    box.className = 'stagione';
    box.appendChild(el('h3', 'reparto-titolo', `Di stagione a ${mese.nome}`));
    box.appendChild(el('p', 'nota', `Frutta: ${mese.frutta.join(', ')}.`));
    box.appendChild(el('p', 'nota', `Verdura: ${mese.verdura.join(', ')}.`));
    return box;
  }

  function disegnaVoce({ chiave, nome, testoQ }) {
    const li = document.createElement('li');
    const presa = Boolean(ctx.stato.spuntate[chiave]);
    li.className = 'voce-spesa' + (presa ? ' presa' : '');
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = presa;
    cb.addEventListener('change', () => {
      impostaSpuntata(ctx.stato, chiave, cb.checked);
      ctx.salva();
      li.classList.toggle('presa', cb.checked);
    });
    const testo = document.createElement('span');
    testo.className = 'voce-testo';
    testo.appendChild(el('span', 'voce-nome', conEmoji(nome)));
    testo.appendChild(el('span', 'voce-q', testoQ));
    label.appendChild(cb);
    label.appendChild(testo);
    li.appendChild(label);
    return li;
  }

  function el(tag, classe, testo) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (testo != null) e.textContent = testo;
    return e;
  }

  disegna();
  return { disegna };
}
