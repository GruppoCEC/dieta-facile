// ==========================================================================
// vincoli.js — contatori settimanali, limiti e frequenze dei secondi
// ==========================================================================
//
// Lavorano sul piano di UNA persona (`piano` = { scelte, extra, aggiornatoIl }).
// Tutte le regole arrivano da dieta.json.

import { GIORNI, SLOT_PRINCIPALI } from './stato.js';
import { trovaOpzione, trovaCarbo, trovaSecondo } from './dati.js';

/**
 * Opzioni selezionate in uno slot di un giorno, con il loro "ruolo".
 * Slot semplici: [{ ruolo: null, opz }]; pranzo/cena: carbo e/o secondo.
 */
export function selezioniSlot(dieta, piano, giorno, slot) {
  const scelta = piano.scelte[giorno][slot];
  const risultato = [];
  if (SLOT_PRINCIPALI.includes(slot)) {
    const carbo = trovaCarbo(dieta, slot, scelta.carbo);
    const secondo = trovaSecondo(dieta, slot, scelta.secondo);
    if (carbo) risultato.push({ ruolo: 'carbo', opz: carbo });
    if (secondo) risultato.push({ ruolo: 'secondo', opz: secondo });
  } else {
    const opz = trovaOpzione(dieta, slot, scelta);
    if (opz) risultato.push({ ruolo: null, opz });
  }
  return risultato;
}

export function haTag(opz, tag) {
  return Boolean(opz) && Array.isArray(opz.tag) && opz.tag.includes(tag);
}

export function contaLimite(dieta, piano, limite, escludi = null) {
  let n = 0;
  for (const giorno of GIORNI) {
    for (const slot of limite.slot) {
      for (const sel of selezioniSlot(dieta, piano, giorno, slot)) {
        if (escludi && escludi.giorno === giorno && escludi.slot === slot && escludi.ruolo === sel.ruolo) continue;
        if (haTag(sel.opz, limite.tag)) n++;
      }
    }
  }
  return n;
}

/** Motivo (in italiano) per cui `opzione` non può essere scelta, oppure null. */
export function motivoBlocco(dieta, piano, giorno, slot, ruolo, opzione) {
  for (const limite of dieta.limitiSettimanali) {
    if (!limite.slot.includes(slot)) continue;
    if (!haTag(opzione, limite.tag)) continue;
    const n = contaLimite(dieta, piano, limite, { giorno, slot, ruolo });
    if (n >= limite.max) {
      return `${limite.descrizione} — già usato ${n} ${n === 1 ? 'volta' : 'volte'}`;
    }
  }
  return null;
}

export function riepilogoLimiti(dieta, piano) {
  return dieta.limitiSettimanali.map(l => {
    const n = contaLimite(dieta, piano, l);
    return { id: l.id, nome: l.nome || l.descrizione, descrizione: l.descrizione, n, max: l.max, pieno: n >= l.max };
  });
}

/**
 * [{ id, nome, n, min, max, stato }] con stato "ok" | "sotto" | "sopra". Il pasto libero non conta.
 * Se una categoria non ha "max" (es. "almeno 4 volte"), non c'è limite superiore.
 * Anche un carboidrato con "categoria" (es. pasta di legumi → legumi) entra nel conteggio.
 */
export function riepilogoSecondi(dieta, piano) {
  const conta = {};
  for (const giorno of GIORNI) {
    for (const slot of SLOT_PRINCIPALI) {
      const sec = trovaSecondo(dieta, slot, piano.scelte[giorno][slot].secondo);
      if (sec && sec.categoria === 'libero') continue;
      if (sec && sec.categoria) conta[sec.categoria] = (conta[sec.categoria] || 0) + 1;
      const carbo = trovaCarbo(dieta, slot, piano.scelte[giorno][slot].carbo);
      if (carbo && carbo.categoria) conta[carbo.categoria] = (conta[carbo.categoria] || 0) + 1;
    }
  }
  return dieta.frequenzeSecondi.categorie.map(c => {
    const n = c.somma ? c.somma.reduce((tot, k) => tot + (conta[k] || 0), 0) : (conta[c.id] || 0);
    let statoCat = 'ok';
    if (n < c.min) statoCat = 'sotto';
    else if (c.max != null && n > c.max) statoCat = 'sopra';
    return { id: c.id, nome: c.nome, n, min: c.min, max: c.max, stato: statoCat };
  });
}

/** Quanti frutti sono previsti in un giorno (escludendo eventualmente uno slot). */
export function fruttaDelGiorno(dieta, piano, giorno, escludiSlot = null) {
  let n = 0;
  for (const s of dieta.slot) {
    if (s.id === escludiSlot) continue;
    for (const sel of selezioniSlot(dieta, piano, giorno, s.id)) {
      if (haTag(sel.opz, 'frutta')) n++;
    }
  }
  return n;
}

/** Quantità del carboidrato con la regola dei legumi. */
export function quantitaCarbo(carbo, secondo) {
  if (!carbo) return null;
  const ridotta = Boolean(secondo) && secondo.categoria === 'legumi' && carbo.qConLegumi != null;
  return { q: ridotta ? carbo.qConLegumi : carbo.q, u: carbo.u, ridotta };
}

/** Vero se in quel giorno tutti gli slot hanno una scelta. */
export function giornoCompleto(dieta, piano, giorno) {
  for (const s of dieta.slot) {
    const scelta = piano.scelte[giorno][s.id];
    if (SLOT_PRINCIPALI.includes(s.id)) {
      const sec = trovaSecondo(dieta, s.id, scelta.secondo);
      const libero = sec && sec.categoria === 'libero';
      if (!scelta.secondo || (!scelta.carbo && !libero)) return false;
    } else if (!scelta) {
      return false;
    }
  }
  return true;
}

export function formattaQuantita(q, u) {
  if (u === 'pz') {
    if (q === 0.5) return '½';
    if (q === 1.5) return '1 e ½';
    if (q === 0.25) return '¼';
    return `${q}`;
  }
  return `${q} ${u}`;
}

/**
 * Variante (sotto-scelta) selezionata per un'opzione, letta dagli extra del pasto.
 * `ruolo` è "carbo" o "secondo" per pranzo/cena, null per gli slot semplici.
 * Restituisce l'oggetto variante oppure null.
 */
export function varianteScelta(opz, extra, ruolo = null) {
  if (!opz || !Array.isArray(opz.varianti) || !extra) return null;
  const id = extra[chiaveVariante(ruolo)];
  return id ? opz.varianti.find(v => v.id === id) || null : null;
}

export function chiaveVariante(ruolo = null) {
  return ruolo ? `variante.${ruolo}` : 'variante';
}

/** Ingredienti effettivi di un'opzione: quelli della variante, se ne ha di propri. */
export function ingredientiEffettivi(opz, variante) {
  if (variante && Array.isArray(variante.ingredienti)) return variante.ingredienti;
  return opz.ingredienti || [];
}

/** Quanta verdura prevede la dieta a pasto: "a volontà" se non indicato in dieta.verduraQuantita. */
export function quantitaVerdura(dieta) {
  return dieta.verduraQuantita || 'a volontà';
}

/** Prima lettera maiuscola. */
export function maiuscola(testo) {
  return testo ? testo.charAt(0).toUpperCase() + testo.slice(1) : '';
}
