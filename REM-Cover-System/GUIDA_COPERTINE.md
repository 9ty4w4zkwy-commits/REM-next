# REM Cover System — v1.0

## Scopo
Rendere riproducibili nel tempo gli allineamenti delle copertine cinematografiche REM, pur mantenendo un'estetica diversa per ogni libro.

## Procedura obbligatoria
1. Creare o recuperare un'**illustrazione originale senza alcun testo e senza cornici**; deve coprire l'intera tela 1200×1800.
2. Verificare che l'illustrazione non contenga margini o cornici nere **incorporate**. Non correggere con una semplice cornice o con `object-fit:contain`.
3. Sovrapporre autore e titolo in un editor a livelli usando `MASTER_COPERTINA.svg` solo come **guida invisibile**. Autore: x=600, bordo superiore visibile y=95; titolo entro x=80…1120 e y=190…550. Salvare i livelli modificabili.
4. Registrare font effettivi e licenze in `FONT_COPERTINE.md`. Font autore differenziabili, quota identica.
5. Esportare JPG/PNG finale 1200×1800 senza le linee guida. Controllare pixel di bordo, testo duplicato, leggibilità, margini e ritagli.
6. Verificare ogni copertina nell'anteprima mobile dell'app REM (carosello: due copertine e parte della terza), senza distorsioni. Approvare individualmente.
7. Solo dopo approvazione, inserire nello ZIP definitivo e pubblicare nell'app.

## Archiviazione consigliata
Conservare per ciascun libro `ORIGINALI/<slug>-art.png` (illustrazione senza scritte), `LIVELLI/<slug>.svg` (composizione modificabile) e `FINALI/<slug>.jpg`. Queste cartelle si popolano **solo con file realmente approvati**, non con bozze difettose.

## Versionamento
Ogni cambiamento di coordinate richiede nuova versione di `REGOLE_GRAFICHE.json`. Non alterare silenziosamente le copertine già approvate. **Il master SVG è una griglia tecnica, non una copertina finita.**

## Stato
Questo commit istituisce lo standard tecnico. **Non sostituisce ancora le copertine online** e non dichiara approvate le 14 bozze precedenti.
