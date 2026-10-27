// ==========================================================================
// settimana.js — scheda "Settimana": persona attiva, giorni × slot, scelta delle opzioni
// ==========================================================================

import {
  GIORNI, SLOT_PRINCIPALI, impostaScelta, impostaExtra, leggiExtra, svuotaPiano,
  nuovaSettimana, lunediDi, caricaUi, salvaUi, pianoDi, meseDellaSettimana
} from './stato.js';
import { trovaOpzione, trovaCarbo, trovaSecondo } from './dati.js';
import {
  motivoBlocco, riepilogoLimiti, riepilogoSecondi, fruttaDelGiorno,
  quantitaCarbo, giornoCompleto, formattaQuantita, haTag, maiuscola, varianteScelta, chiaveVariante,
  quantitaVerdura
} from './vincoli.js';
import { apriFoglio, chiudiFoglio, aggiornaFoglio } from './foglio.js';
import { kcalPasto, kcalGiorno, kcalMediaSettimana, formattaKcal, calorieDisponibili } from './calorie.js';

/** ctx = { dieta, stagioni, stato, salva(), aggiornaIntestazione(), apriImpostazioni() } */
export function montaSettimana(contenitore, ctx) {
  const ui = caricaUi();
  let giornoAttivo = GIORNI.includes(ui.giorno) ? ui.giorno : GIORNI[(new Date().getDay() + 6) % 7];
  let personaAttiva = ui.persona || null;

  function persona() {
    const lista = ctx.stato.persone;
    if (!lista.some(p => p.id === personaAttiva)) personaAttiva = lista[0].id;
    return lista.find(p => p.id === personaAttiva);
  }

  function piano() {
    return pianoDi(ctx.stato, persona().id);
  }

  function stagione() {
    const mese = meseDellaSettimana(ctx.stato.settimanaDel);
    return ctx.stagioni.mesi[String(mese)];
  }

  function cambiaGiorno(g) {
    giornoAttivo = g;
    salvaUi({ ...caricaUi(), giorno: g });
    disegna();
  }

  function cambiaPersona(id) {
    personaAttiva = id;
    salvaUi({ ...caricaUi(), persona: id });
    disegna();
  }

  function mostraCalorie() {
    return calorieDisponibili() && caricaUi().calorie !== false;
  }

  function salvaEDisegna() {
    ctx.salva();
    disegna();
  }

  // ----- Disegno principale --------------------------------------------------

  function disegna() {
    const { dieta, stato } = ctx;
    const p = piano();
    contenitore.innerHTML = '';

    if (stato.persone.length > 1) contenitore.appendChild(disegnaPersone(stato));
    contenitore.appendChild(disegnaRiepilogo(dieta, p));
    contenitore.appendChild(disegnaGiorni(dieta, p));

    const titolo = document.createElement('h2');
    titolo.className = 'titolo-giorno';
    titolo.textContent = dieta.giorni.find(g => g.id === giornoAttivo).nome;
    contenitore.appendChild(titolo);
    if (mostraCalorie()) contenitore.appendChild(disegnaCalorieGiorno(dieta, p, giornoAttivo));

    const listaSlot = document.createElement('div');
    listaSlot.className = 'slot';
    for (const s of dieta.slot) listaSlot.appendChild(disegnaCartaSlot(dieta, p, giornoAttivo, s));
    contenitore.appendChild(listaSlot);

    contenitore.appendChild(disegnaAzioni());
  }

  function disegnaPersone(stato) {
    const box = document.createElement('div');
    box.className = 'persone';
    for (const p of stato.persone) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'persona-btn' + (p.id === persona().id ? ' attivo' : '');
      b.textContent = p.nome;
      b.addEventListener('click', () => cambiaPersona(p.id));
      box.appendChild(b);
    }
    return box;
  }

  function disegnaRiepilogo(dieta, p) {
    const blocco = document.createElement('div');
    blocco.appendChild(titoletto('Secondi della settimana (pranzo + cena)'));
    const r1 = document.createElement('div');
    r1.className = 'riepilogo';
    for (const c of riepilogoSecondi(dieta, p)) {
      const chip = document.createElement('span');
      chip.className = `chip ${c.stato}`;
      const obiettivo = c.max == null ? `almeno ${c.min}`
        : c.min === c.max ? `${c.max}` : (c.min === 0 ? `max ${c.max}` : `${c.min}-${c.max}`);
      chip.textContent = `${c.nome}: ${c.n} / ${obiettivo}`;
      r1.appendChild(chip);
    }
    blocco.appendChild(r1);

    blocco.appendChild(titoletto('Limiti settimanali'));
    const r2 = document.createElement('div');
    r2.className = 'riepilogo';
    for (const l of riepilogoLimiti(dieta, p)) {
      const chip = document.createElement('span');
      chip.className = `chip ${l.pieno ? 'pieno' : ''}`;
      chip.textContent = `${l.nome}: ${l.n} / ${l.max}`;
      chip.title = l.descrizione;
      r2.appendChild(chip);
    }
    blocco.appendChild(r2);
    return blocco;
  }

  function disegnaCalorieGiorno(dieta, p, giorno) {
    const k = kcalGiorno(dieta, p, giorno);
    const box = el('div', 'kcal-giorno');
    if (k.pasti === 0) {
      box.textContent = 'Calorie: compila i pasti per vedere la stima.';
      return box;
    }
    const note = [];
    if (k.libero) note.push('senza il pasto libero');
    if (k.incompleto) note.push('alcuni alimenti senza valore');
    if (k.pasti < dieta.slot.length) note.push(`${k.pasti} pasti su ${dieta.slot.length}`);
    let testo = `≈ ${formattaKcal(k.kcal)} kcal oggi`;
    const media = kcalMediaSettimana(dieta, p);
    if (media && media.giorni > 1) testo += ` · media ≈ ${formattaKcal(media.media)} kcal/giorno`;
    box.appendChild(el('span', 'kcal-valore', testo));
    box.appendChild(el('span', 'kcal-nota', `stima indicativa (±15%), verdura esclusa${note.length ? ' · ' + note.join(' · ') : ''}`));
    return box;
  }

  function disegnaGiorni(dieta, p) {
    const nav = document.createElement('div');
    nav.className = 'giorni';
    for (const g of dieta.giorni) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'giorno-btn';
      if (g.id === giornoAttivo) b.classList.add('attivo');
      if (giornoCompleto(dieta, p, g.id)) b.classList.add('completo');
      b.innerHTML = `<span>${g.nome.slice(0, 3)}</span><span class="puntino"></span>`;
      b.addEventListener('click', () => cambiaGiorno(g.id));
      nav.appendChild(b);
    }
    return nav;
  }

  function disegnaCartaSlot(dieta, p, giorno, slotDef) {
    const carta = document.createElement('button');
    carta.type = 'button';
    carta.className = 'carta-slot';
    carta.appendChild(el('span', 'etichetta', slotDef.nome));

    const scelta = p.scelte[giorno][slotDef.id];
    const extra = leggiExtra(p, giorno, slotDef.id);

    if (SLOT_PRINCIPALI.includes(slotDef.id)) {
      const carbo = trovaCarbo(dieta, slotDef.id, scelta.carbo);
      const secondo = trovaSecondo(dieta, slotDef.id, scelta.secondo);
      const libero = secondo && secondo.categoria === 'libero';

      if (libero) {
        carta.appendChild(el('span', 'valore', 'Pasto libero'));
        carta.appendChild(el('span', 'dettaglio', secondo.descrizione));
      } else if (!carbo && !secondo) {
        carta.appendChild(el('span', 'valore vuoto', 'Scegli carboidrato e secondo…'));
        carta.appendChild(el('span', 'dettaglio', `${dieta[slotDef.id].verdura} · olio EVO ${dieta[slotDef.id].olio.q} g`));
      } else {
        const parti = [];
        const vc = varianteScelta(carbo, extra, 'carbo');
        const vs = varianteScelta(secondo, extra, 'secondo');
        if (carbo) {
          const q = quantitaCarbo(carbo, secondo);
          parti.push(`${vc ? vc.nome : nomeBreve(carbo)} ${formattaQuantita(q.q, q.u)}`);
        } else parti.push('carboidrato da scegliere');
        if (secondo) parti.push(vs ? `${secondo.nome}: ${vs.nome.toLowerCase()}` : secondo.nome);
        else parti.push('secondo da scegliere');
        carta.appendChild(el('span', 'valore', parti.join(' + ')));

        const pezzi = [];
        if (secondo) pezzi.push(vs ? descrizioneVariante(vs, secondo) : secondo.descrizione);
        if (secondo && secondo.varianti && !vs) pezzi.push('tocca per scegliere quale');
        const q = quantitaCarbo(carbo, secondo);
        if (q && q.ridotta) pezzi.push('carboidrato ridotto perché il secondo è legumi');
        pezzi.push(`olio EVO ${dieta[slotDef.id].olio.q} g`);
        carta.appendChild(el('span', 'dettaglio', pezzi.join(' · ')));

        const verdure = extra.verdura && extra.verdura.length ? extra.verdura.join(', ') : `di stagione, ${quantitaVerdura(dieta)} (tocca per scegliere)`;
        carta.appendChild(el('span', 'dettaglio-extra', `Verdura: ${verdure}`));
      }
    } else {
      const opz = trovaOpzione(dieta, slotDef.id, scelta);
      const vo = varianteScelta(opz, extra, null);
      carta.appendChild(el('span', opz ? 'valore' : 'valore vuoto', opz ? (vo ? `${opz.nome}: ${vo.nome.toLowerCase()}` : opz.nome) : 'Scegli…'));
      if (opz && opz.descrizione) carta.appendChild(el('span', 'dettaglio', opz.descrizione));
      if (opz && opz.varianti && !vo) carta.appendChild(el('span', 'dettaglio-extra', 'Quale? tocca per scegliere'));
      if (opz && haTag(opz, 'frutta')) {
        carta.appendChild(el('span', 'dettaglio-extra', `Frutto: ${extra.frutta ? extra.frutta : 'di stagione (tocca per scegliere)'}`));
      }
    }

    if (mostraCalorie()) {
      const k = kcalPasto(dieta, p, giorno, slotDef.id);
      if (!k.vuoto && !k.libero) carta.appendChild(el('span', 'kcal', `≈ ${formattaKcal(k.kcal)} kcal${k.incompleto ? ' (parziale)' : ''}`));
    }

    carta.addEventListener('click', () => apriScelta(giorno, slotDef));
    return carta;
  }

  function disegnaAzioni() {
    const box = document.createElement('div');
    box.className = 'azioni';
    const nome = persona().nome;

    box.appendChild(pulsante(`Compila la settimana a caso`, 'primario', () => {
      if (!confirm(`Compilo tutta la settimana di ${nome} con scelte casuali che rispettano il piano? Le scelte attuali verranno sostituite. Puoi premere di nuovo per una combinazione diversa.`)) return;
      compilaCasuale(piano());
      salvaEDisegna();
    }));

    box.appendChild(pulsante(`Svuota settimana`, 'pericolo', () => {
      if (!confirm(`Cancello tutte le scelte di ${nome} per questa settimana?`)) return;
      svuotaPiano(piano());
      salvaEDisegna();
    }));

    box.appendChild(pulsante('Nuova settimana', '', () => {
      if (!confirm('Inizio una nuova settimana vuota da lunedì prossimo, per tutte le persone? Le scelte attuali verranno cancellate.')) return;
      nuovaSettimana(ctx.stato, lunediDi(new Date(Date.now() + 7 * 24 * 3600 * 1000)));
      ctx.salva();
      ctx.aggiornaIntestazione();
      disegna();
    }));

    return box;
  }

  // ----- Foglio di scelta --------------------------------------------------

  function apriScelta(giorno, slotDef) {
    const nomeGiorno = ctx.dieta.giorni.find(g => g.id === giorno).nome;
    apriFoglio(`${slotDef.nome} — ${nomeGiorno} (${persona().nome})`, costruisciFoglio(giorno, slotDef));
  }

  function rinfrescaFoglio(giorno, slotDef) {
    aggiornaFoglio(costruisciFoglio(giorno, slotDef));
  }

  function costruisciFoglio(giorno, slotDef) {
    const { dieta } = ctx;
    const p = piano();
    const corpo = document.createElement('div');
    const principale = SLOT_PRINCIPALI.includes(slotDef.id);

    if (principale) {
      const secondo = trovaSecondo(dieta, slotDef.id, p.scelte[giorno][slotDef.id].secondo);
      const carbo = trovaCarbo(dieta, slotDef.id, p.scelte[giorno][slotDef.id].carbo);
      corpo.appendChild(sezioneScelta(p, giorno, slotDef, 'secondo', 'Secondo', dieta[slotDef.id].secondi));
      if (secondo && secondo.varianti) corpo.appendChild(sezioneVariante(p, giorno, slotDef, secondo, 'secondo'));
      if (!(secondo && secondo.categoria === 'libero')) {
        corpo.appendChild(sezioneScelta(p, giorno, slotDef, 'carbo', 'Carboidrato', dieta[slotDef.id].carboidrati));
        if (carbo && carbo.varianti) corpo.appendChild(sezioneVariante(p, giorno, slotDef, carbo, 'carbo'));
        corpo.appendChild(sezioneVerdura(p, giorno, slotDef));
        corpo.appendChild(el('p', 'nota', `+ olio EVO ${dieta[slotDef.id].olio.q} g (${dieta[slotDef.id].olio.descrizione})`));
      }
      const fine = document.createElement('div');
      fine.className = 'azioni';
      fine.appendChild(pulsante('Fatto', 'primario', chiudiFoglio));
      corpo.appendChild(fine);
    } else {
      if (slotDef.id === 'merenda') {
        const frutti = fruttaDelGiorno(dieta, p, giorno, 'merenda');
        if (frutti >= dieta.fruttaAlGiorno.consigliata) {
          corpo.appendChild(el('div', 'avviso', `Oggi hai già ${frutti} frutti: meglio una merenda senza frutta.`));
        }
      }
      const opz = trovaOpzione(dieta, slotDef.id, p.scelte[giorno][slotDef.id]);
      if (opz && opz.varianti) corpo.appendChild(sezioneVariante(p, giorno, slotDef, opz, null));
      if (opz && haTag(opz, 'frutta')) corpo.appendChild(sezioneFrutta(p, giorno, slotDef));
      corpo.appendChild(sezioneScelta(p, giorno, slotDef, null, opz ? 'Cambia scelta' : null, dieta[slotDef.id].opzioni));
    }
    return corpo;
  }

  function sezioneScelta(p, giorno, slotDef, ruolo, titolo, opzioni) {
    const { dieta } = ctx;
    const slot = slotDef.id;
    const box = document.createElement('div');
    if (titolo) box.appendChild(titoletto(titolo));

    const sceltaAttuale = ruolo ? p.scelte[giorno][slot][ruolo] : p.scelte[giorno][slot];
    const secondoAttuale = SLOT_PRINCIPALI.includes(slot) ? trovaSecondo(dieta, slot, p.scelte[giorno][slot].secondo) : null;
    const fruttiOggi = fruttaDelGiorno(dieta, p, giorno, slot);
    const mostraNotaFrutta = slot === 'merenda' && fruttiOggi >= dieta.fruttaAlGiorno.consigliata;

    const dopoScelta = (opzScelta) => {
      ctx.salva();
      disegna();
      const resta = SLOT_PRINCIPALI.includes(slot) || (opzScelta && (haTag(opzScelta, 'frutta') || opzScelta.varianti));
      if (resta) rinfrescaFoglio(giorno, slotDef);
      else chiudiFoglio();
    };

    box.appendChild(vocePulsante('— Nessuna scelta —', '', null, sceltaAttuale === null, () => {
      impostaScelta(p, giorno, slot, null, ruolo);
      impostaExtra(p, giorno, slot, chiaveVariante(ruolo), null);
      if (!ruolo) impostaExtra(p, giorno, slot, 'frutta', null);
      dopoScelta(null);
    }));

    for (const opz of opzioni) {
      const motivo = motivoBlocco(dieta, p, giorno, slot, ruolo, opz);
      let descrizione = opz.descrizione || '';
      if (ruolo === 'carbo') {
        const q = quantitaCarbo(opz, secondoAttuale);
        descrizione = `${formattaQuantita(q.q, q.u)}${q.ridotta ? ' (ridotto: secondo legumi)' : ''}`;
      }
      const nota = mostraNotaFrutta && haTag(opz, 'frutta') ? 'contiene frutta' : '';
      box.appendChild(vocePulsante(opz.nome, descrizione, motivo, opz.id === sceltaAttuale, () => {
        if (opz.id !== sceltaAttuale) impostaExtra(p, giorno, slot, chiaveVariante(ruolo), null);
        impostaScelta(p, giorno, slot, opz.id, ruolo);
        if (!ruolo && !haTag(opz, 'frutta')) impostaExtra(p, giorno, slot, 'frutta', null);
        dopoScelta(opz);
      }, nota));
    }
    return box;
  }

  /** Chips per la sotto-scelta di un'opzione (es. formaggio → ricotta / primo sale / …). */
  function sezioneVariante(p, giorno, slotDef, opz, ruolo) {
    const extra = leggiExtra(p, giorno, slotDef.id);
    const attuale = extra[chiaveVariante(ruolo)] || null;
    const box = document.createElement('div');
    box.appendChild(titoletto(`${opz.nome}: quale?`));
    const chips = document.createElement('div');
    chips.className = 'chips';
    chips.appendChild(chip('Non specificato', !attuale, () => {
      impostaExtra(p, giorno, slotDef.id, chiaveVariante(ruolo), null);
      ctx.salva(); disegna(); rinfrescaFoglio(giorno, slotDef);
    }));
    for (const v of opz.varianti) {
      const q = v.ingredienti && v.ingredienti[0] ? ` ${formattaQuantita(v.ingredienti[0].q, v.ingredienti[0].u)}` : '';
      chips.appendChild(chip(`${v.nome}${q}`, attuale === v.id, () => {
        impostaExtra(p, giorno, slotDef.id, chiaveVariante(ruolo), v.id);
        ctx.salva(); disegna(); rinfrescaFoglio(giorno, slotDef);
      }));
    }
    box.appendChild(chips);
    return box;
  }

  function descrizioneVariante(v, opz) {
    if (v.ingredienti && v.ingredienti.length) {
      return v.ingredienti.map(i => `${i.nome} ${formattaQuantita(i.q, i.u)}`).join(' + ');
    }
    return opz.descrizione || v.nome;
  }

  /** Chips per scegliere il frutto di stagione. */
  function sezioneFrutta(p, giorno, slotDef) {
    const st = stagione();
    const extra = leggiExtra(p, giorno, slotDef.id);
    const box = document.createElement('div');
    box.appendChild(titoletto(`Quale frutto? Di stagione a ${st.nome}`));
    const chips = document.createElement('div');
    chips.className = 'chips';
    chips.appendChild(chip('Qualsiasi', !extra.frutta, () => {
      impostaExtra(p, giorno, slotDef.id, 'frutta', null);
      ctx.salva(); disegna(); rinfrescaFoglio(giorno, slotDef);
    }));
    for (const f of st.frutta) {
      chips.appendChild(chip(maiuscola(f), extra.frutta === f, () => {
        impostaExtra(p, giorno, slotDef.id, 'frutta', f);
        ctx.salva(); disegna(); rinfrescaFoglio(giorno, slotDef);
      }));
    }
    box.appendChild(chips);
    return box;
  }

  /** Chips per scegliere le verdure di stagione (più di una). */
  function sezioneVerdura(p, giorno, slotDef) {
    const st = stagione();
    const extra = leggiExtra(p, giorno, slotDef.id);
    const scelte = extra.verdura || [];
    const box = document.createElement('div');
    box.appendChild(titoletto(`Verdura, ${quantitaVerdura(ctx.dieta)} — di stagione a ${st.nome} (puoi sceglierne più di una)`));
    const chips = document.createElement('div');
    chips.className = 'chips';
    for (const v of verdureDiStagione(ctx.dieta, st)) {
      const attiva = scelte.includes(v);
      chips.appendChild(chip(maiuscola(v), attiva, () => {
        const nuove = attiva ? scelte.filter(x => x !== v) : [...scelte, v];
        impostaExtra(p, giorno, slotDef.id, 'verdura', nuove);
        ctx.salva(); disegna(); rinfrescaFoglio(giorno, slotDef);
      }));
    }
    box.appendChild(chips);
    return box;
  }

  function vocePulsante(nome, descrizione, motivo, selezionata, azione, notaFrutta = '') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opzione' + (selezionata ? ' selezionata' : '');
    b.disabled = Boolean(motivo);
    b.appendChild(el('span', 'nome', nome));
    if (descrizione) b.appendChild(el('span', 'descrizione', descrizione));
    if (notaFrutta) b.appendChild(el('span', 'nota-frutta', notaFrutta));
    if (motivo) b.appendChild(el('span', 'motivo', motivo));
    if (!motivo) b.addEventListener('click', azione);
    return b;
  }

  // ----- Compilazione casuale (rispettando la dieta) -------------------------

  function mescola(lista) {
    const a = [...lista];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function aCaso(lista) {
    return lista[Math.floor(Math.random() * lista.length)];
  }

  /** Prima opzione, in ordine casuale, che non viola un limite settimanale. */
  function scegliCasuale(p, giorno, slot, ruolo, candidati) {
    for (const opz of mescola(candidati)) {
      if (!motivoBlocco(ctx.dieta, p, giorno, slot, ruolo, opz)) return opz;
    }
    return null;
  }

  /**
   * Compila la settimana in modo casuale ma coerente con il piano:
   *  - i secondi seguono lo schema tipo (stesse frequenze), ma i giorni vengono mescolati
   *    e la categoria "formaggio" a cena può diventare "uova" (il piano lo consente);
   *  - per ogni categoria si estrae a caso un secondo e la sua variante;
   *  - colazione, carboidrato, merenda e dopo cena sono estratti tra le opzioni permesse,
   *    rispettando i limiti settimanali; la merenda evita la frutta se il giorno ne ha già 2;
   *  - frutto e verdure vengono scelti tra quelli di stagione.
   */
  function compilaCasuale(p) {
    const { dieta } = ctx;
    const schema = dieta.schemaTipo;
    const st = stagione();
    svuotaPiano(p);

    // 1) secondi: permuta i giorni dello schema tipo, separatamente per pranzo e cena
    const giorniMescolati = { pranzo: mescola(GIORNI), cena: mescola(GIORNI) };
    const secondoPer = { pranzo: {}, cena: {} };
    const carboPer = { pranzo: {}, cena: {} }; // carboidrato fissato dallo schema, se la dieta lo indica
    for (const slot of SLOT_PRINCIPALI) {
      GIORNI.forEach((g, i) => {
        const giornoSchema = giorniMescolati[slot][i];
        const idSchema = schema[slot][giornoSchema];
        if (schema.carboidrati && schema.carboidrati[slot]) {
          carboPer[slot][g] = trovaCarbo(dieta, slot, schema.carboidrati[slot][giornoSchema]);
        }
        const base = trovaSecondo(dieta, slot, idSchema);
        if (!base) return;
        let categoria = base.categoria;
        if (slot === 'cena' && categoria === 'formaggio' && Math.random() < 0.5) categoria = 'uova';
        const candidati = dieta[slot].secondi.filter(s => s.categoria === categoria);
        secondoPer[slot][g] = { base, candidati };
      });
    }

    for (const g of GIORNI) {
      const giorno = p.scelte[g];

      // 2) colazione e spuntino (solo se la dieta li prevede)
      if (dieta.colazione) {
        const col = scegliCasuale(p, g, 'colazione', null, dieta.colazione.opzioni);
        giorno.colazione = col ? col.id : dieta.colazione.opzioni[0].id;
      }
      if (dieta.spuntino) {
        const spu = scegliCasuale(p, g, 'spuntino', null, dieta.spuntino.opzioni);
        giorno.spuntino = spu ? spu.id : dieta.spuntino.opzioni[0].id;
      }

      // 3) pranzo e cena: secondo (con variante), carboidrato (con variante), verdure
      for (const slot of SLOT_PRINCIPALI) {
        const scelta = secondoPer[slot][g];
        // tra i secondi della categoria prevista, uno a caso che non superi i limiti (es. affettato max 1)
        const secondo = scelta ? (scegliCasuale(p, g, slot, 'secondo', scelta.candidati) || scelta.base) : null;
        giorno[slot] = { carbo: null, secondo: secondo ? secondo.id : null };
        if (!secondo || secondo.categoria === 'libero') continue;
        if (secondo.varianti) impostaExtra(p, g, slot, chiaveVariante('secondo'), aCaso(secondo.varianti).id);
        const carbo = carboPer[slot][g] || scegliCasuale(p, g, slot, 'carbo', dieta[slot].carboidrati);
        if (carbo) {
          giorno[slot].carbo = carbo.id;
          if (carbo.varianti) impostaExtra(p, g, slot, chiaveVariante('carbo'), aCaso(carbo.varianti).id);
        }
        const nVerdure = 1 + Math.floor(Math.random() * 2);
        impostaExtra(p, g, slot, 'verdura', mescola(verdureDiStagione(dieta, st)).slice(0, nVerdure));
      }

      // 4) merenda: senza frutta se il giorno ne ha già abbastanza (e se esistono alternative)
      if (dieta.merenda) {
        const fruttiOggi = fruttaDelGiorno(dieta, p, g, 'merenda');
        const senzaFrutta = dieta.merenda.opzioni.filter(o => !haTag(o, 'frutta'));
        const merende = fruttiOggi >= dieta.fruttaAlGiorno.consigliata && senzaFrutta.length ? senzaFrutta : dieta.merenda.opzioni;
        const mer = scegliCasuale(p, g, 'merenda', null, merende) || scegliCasuale(p, g, 'merenda', null, dieta.merenda.opzioni);
        giorno.merenda = mer ? mer.id : null;
      }

      // 5) dopo cena
      if (dieta.dopocena) {
        const conIngredienti = dieta.dopocena.opzioni.filter(o => o.ingredienti.length);
        giorno.dopocena = aCaso(conIngredienti.length ? conIngredienti : dieta.dopocena.opzioni).id;
      }

      // 6) frutto di stagione e varianti per gli slot semplici
      for (const s of dieta.slot) {
        if (SLOT_PRINCIPALI.includes(s.id)) continue;
        const opz = trovaOpzione(dieta, s.id, giorno[s.id]);
        if (!opz) continue;
        if (haTag(opz, 'frutta')) impostaExtra(p, g, s.id, 'frutta', aCaso(st.frutta));
        if (opz.varianti) impostaExtra(p, g, s.id, chiaveVariante(null), aCaso(opz.varianti).id);
      }
    }
    p.aggiornatoIl = new Date().toISOString();
  }

  // ----- Piccoli aiuti -----------------------------------------------------

  function el(tag, classe, testo) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (testo != null) e.textContent = testo;
    return e;
  }

  function titoletto(testo) {
    return el('div', 'foglio-sezione', testo);
  }

  function chip(testo, attiva, azione) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip chip-btn' + (attiva ? ' attiva' : '');
    b.textContent = testo;
    b.addEventListener('click', azione);
    return b;
  }

  function pulsante(testo, classe, azione) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `pulsante ${classe}`.trim();
    b.textContent = testo;
    b.addEventListener('click', azione);
    return b;
  }

  /**
   * Verdure di stagione del mese; se la dieta indica "verdureAmmesse" (parole chiave),
   * solo quelle previste dal piano. Se nel mese non ce n'è nessuna, l'elenco completo.
   */
  function verdureDiStagione(dieta, st) {
    if (!Array.isArray(dieta.verdureAmmesse)) return st.verdura;
    const ammesse = st.verdura.filter(v => dieta.verdureAmmesse.some(p => v.toLowerCase().includes(p)));
    return ammesse.length ? ammesse : st.verdura;
  }

  function nomeBreve(carbo) {
    return carbo.nome.replace(/ \(.*\)$/, '');
  }

  disegna();
  return { disegna };
}
