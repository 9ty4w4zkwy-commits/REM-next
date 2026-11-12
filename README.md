# REM Next

Nuova app web indipendente dalla REM 5.6. Versione iniziale 0.1, non ancora validata da tester.

## Avvio

Serve un server HTTP (non aprire index.html come file locale):

```bash
python3 -m http.server 8000
```

Apri http://localhost:8000. Esegui i test con `npm test` (Node.js 20+).

## Aggiungere un libro

1. Crea `content/books/nuovo-libro/`.
2. Inserisci i capitoli in file `.txt` (es. `capitolo-1.txt`).
3. Aggiungi una voce a `content/books/catalog.json` con ID univoco, titolo, autore, `status: published` e `chapters: [{id,title,file}]`.
4. Usa `status: draft` per nascondere un libro senza eliminarlo.
5. Per rimuovere un libro dal catalogo, elimina la sua voce.

Il codice del lettore non va modificato per aggiungere titoli. Non pubblicare opere senza i necessari diritti.

## Architettura

- `src/catalog.js`: validazione e caricamento dei dati
- `src/progress.js`: progressi e impostazioni sul dispositivo
- `src/ui.js`: elementi UI riutilizzabili
- `src/main.js`: Home, Biblioteca, dettaglio e lettore (da suddividere ulteriormente)
- `styles/app.css`: grafica responsive
- `tests/`: test unitari

## Limiti noti

È una base nuova, non una replica funzionale completa della 5.6. Il libro incluso è solo dimostrativo. Non include ancora autenticazione, raccolta feedback, analytics, audio, Focus Mode o pannello amministrativo. I progressi sono salvati solo sul dispositivo; cancellare i dati del browser li elimina. Il repository pubblico espone tutto il catalogo e i testi caricati.

Per pubblicare il sito: GitHub → Settings → Pages → Build and deployment → Deploy from a branch → main / (root). Prima dei test reali verificare licenze dei contenuti e informativa privacy se si aggiungono strumenti di raccolta dati.
