// ==========================================================================
// dati.js — caricamento dei file JSON: registro delle diete, dieta scelta,
// ricettario, stagionalità, emoji, calorie
// ==========================================================================

// Versione dei dati: deve coincidere con ?v= in index.html e con VERSIONE in sw.js.
// Serve a scavalcare le cache (GitHub Pages, browser) quando si pubblica un aggiornamento.
export const VERSIONE_DATI = '10';

const RICETTE_COMUNI = 'dati/ricette.json';
let registro = null;
const cache = {};

/** Elenco delle diete disponibili: [{ id, nome, file, ricette? }]. */
export async function caricaRegistro() {
  if (!registro) {
    const r = await caricaJson('dati/diete.json');
    registro = Array.isArray(r.diete) ? r.diete : [];
    if (!registro.length) throw new Error('Il registro dati/diete.json non contiene nessuna dieta.');
  }
  return registro;
}

/** La voce del registro per un id, oppure null. */
export async function trovaDieta(dietaId) {
  const lista = await caricaRegistro();
  return lista.find(d => d.id === dietaId) || null;
}

/**
 * Carica tutti i dati necessari per una dieta (una sola volta per id).
 * Restituisce { dietaInfo, dieta, ricette, stagioni, emoji, calorie }.
 */
export async function caricaDati(dietaId) {
  if (cache[dietaId]) return cache[dietaId];
  const info = await trovaDieta(dietaId);
  if (!info) throw new Error(`Dieta "${dietaId}" non trovata nel registro.`);

  const [dieta, ricetteBase, aggiuntive, stagioni, emoji, calorie] = await Promise.all([
    caricaJson(info.file),
    caricaJson(info.ricette || RICETTE_COMUNI),
    info.ricetteAggiuntive ? caricaJson(info.ricetteAggiuntive) : null,
    caricaJson('dati/stagioni.json'),
    caricaJson('dati/emoji.json'),
    caricaJson('dati/calorie.json')
  ]);
  const ricette = aggiuntive ? unisciRicettari(ricetteBase, aggiuntive) : ricetteBase;
  cache[dietaId] = { dietaInfo: info, dieta, ricette, stagioni, emoji, calorie };
  return cache[dietaId];
}

/**
 * Ricettario comune + ricette aggiuntive di una sola dieta ("ricetteAggiuntive" nel registro).
 * Le ricette aggiuntive vengono prima; le categorie nuove si aggiungono in fondo.
 */
function unisciRicettari(base, aggiuntive) {
  const categorie = [...base.categorie];
  for (const c of aggiuntive.categorie || []) {
    if (!categorie.some(x => x.id === c.id)) categorie.push(c);
  }
  return { ...base, categorie, ricette: [...(aggiuntive.ricette || []), ...base.ricette] };
}

async function caricaJson(percorso) {
  const risposta = await fetch(`${percorso}?v=${VERSIONE_DATI}`);
  if (!risposta.ok) throw new Error(`Impossibile caricare ${percorso} (errore ${risposta.status})`);
  try {
    return await risposta.json();
  } catch (e) {
    throw new Error(`Il file ${percorso} non è un JSON valido: ${e.message}`);
  }
}

/** Opzione di uno slot semplice (colazione, spuntino, merenda, dopocena). */
export function trovaOpzione(dieta, slotId, id) {
  if (!id) return null;
  const lista = dieta[slotId] && dieta[slotId].opzioni;
  return lista ? lista.find(o => o.id === id) || null : null;
}

export function trovaCarbo(dieta, slotId, id) {
  if (!id) return null;
  const lista = dieta[slotId] && dieta[slotId].carboidrati;
  return lista ? lista.find(o => o.id === id) || null : null;
}

export function trovaSecondo(dieta, slotId, id) {
  if (!id) return null;
  const lista = dieta[slotId] && dieta[slotId].secondi;
  return lista ? lista.find(o => o.id === id) || null : null;
}
