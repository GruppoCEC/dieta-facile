# Aggiungere la dieta di un'altra famiglia

L'app può servire più famiglie, ognuna con la propria dieta. Le famiglie condividono solo
il codice: dati, sincronizzazione e lista della spesa sono separati.

## 1. Trascrivere la dieta

1. Scegliere un **id** breve, senza spazi né nomi di persone (es. `mediterranea-b`).
   Non cambiarlo dopo l'uso: è nel link e nel nome del salvataggio.
2. Creare `dati/diete/<id>/dieta.json` con lo **stesso formato** delle diete esistenti
   (slot, opzioni con ingredienti e tag, carboidrati e secondi di pranzo/cena, varianti,
   limiti settimanali, frequenze dei secondi, schema tipo). Il modo più rapido: partire da
   una copia di `dati/diete/mediterranea-a/dieta.json` e sostituire i contenuti.
3. Scrivere la tabella di verifica `docs/diete/<id>.md` e farla confermare contro il PDF.
4. Se la dieta ha un proprio ricettario: `dati/diete/<id>/ricette.json` (stesso formato
   di `dati/ricette.json`). Altrimenti si usa il ricettario comune. Per **aggiungere** ricette
   al ricettario comune solo per quella dieta, usare `ricetteAggiuntive` nel registro (vedi sotto).
   Campi facoltativi della dieta: `verduraQuantita` (es. "circa 200 g a pasto"; se manca l'app
   scrive "a volontà") e `verdureAmmesse` (parole chiave: l'app propone solo le verdure di
   stagione che le contengono). Una frequenza senza `max` significa "almeno `min` volte".
   Un carboidrato con `categoria` (es. pasta di ceci → `legumi`) conta nelle frequenze come un secondo.
5. Alimenti nuovi: aggiungere le parole chiave in `dati/emoji.json` e `dati/calorie.json`
   (l'ordine conta: le voci più specifiche prima).

## 2. Registrarla

In `dati/diete.json` aggiungere una riga:

```json
{ "id": "mediterranea-b", "nome": "Dieta mediterranea — famiglia 2", "file": "dati/diete/mediterranea-b/dieta.json" }
```

(con `"ricette": "dati/diete/mediterranea-b/ricette.json"` se ha un ricettario proprio,
oppure `"ricetteAggiuntive": "dati/diete/mediterranea-b/ricette.json"` per sommarlo a quello comune).
Aggiungere i file nuovi a `FILE_APP` in `sw.js`, aumentare la versione (vedi
`PUBBLICAZIONE.md`) e pubblicare.

## 3. Preparare la nuova famiglia

1. **Repository privato dei dati** e **token** tutti loro, seguendo `SINCRONIZZAZIONE.md`
   (possono usare il proprio account GitHub: il repository dell'app resta il tuo).
2. Dare loro il link con la dieta già scelta:
   `https://TUO-UTENTE.github.io/dieta-facile/?dieta=mediterranea-b`
   Al primo avvio l'app memorizza la scelta sul dispositivo e toglie il parametro.
3. Aggiungere alla Home dell'iPhone, aprire ⚙︎, inserire i dati di sincronizzazione.

## Cosa protegge le famiglie l'una dall'altra

- Ogni dispositivo salva le scelte in una chiave separata per dieta.
- Il file `piano.json` nel repository porta l'id della dieta: se un dispositivo è collegato
  a un repository di un'altra dieta, l'app **non fonde nulla** e si ricarica con la dieta
  del repository.
- Un backup di una dieta non può essere importato in un'altra.
