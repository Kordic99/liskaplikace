# Dračí archiv

Osobní čtenářská knihovna pro počítač i iPhone. Přehled knih, TBR, zápisky, citáty, postavy, hodnocení a nákupní list v temném dračím stylu. Samolepka je nahoře u uvítání, mobil má spodní navigaci a podporu přidání na plochu.

## Online verze

GitHub Pages poskytuje aplikaci a Supabase zajišťuje přihlášení i společná data. Cílová adresa: https://kordic99.github.io/draci-archiv/

Na počítači i telefonu použij **stejný účet aplikace**. Účet v administraci Supabase je jiný než přihlášení do Dračího archivu. Nejdřív si jednou vytvoř účet v aplikaci a potvrď e-mail, pokud to Supabase vyžaduje.

Data jsou chráněná Row Level Security: každý účet čte a mění jen své knihy. Nepřihlášený návštěvník nemá přístup k databázové tabulce. Klient obsahuje pouze veřejný publishable klíč. Soukromé knihy, zápisky, hesla ani zálohy se do GitHubu neukládají.

Změny se načítají přes Supabase Realtime, při návratu do okna a každých 15 sekund při otevřené aplikaci. Ukládání i odstranění kontroluje revizi knihy, aby starší zařízení nepřepsalo novější obsah. Při otevřeném editoru se automatické nahrazování dat pozastaví. Chyba uložení ponechá formulář otevřený. K ukládání je potřeba internet; fronta pro ukládání bez internetu není implementovaná. Rozpracovaný formulář před zavřením stránky ulož nebo si zkopíruj jeho text.

## Přenos původní knihovny

1. V původním místním HTML zvol Zálohovat knihovnu.
2. V online archivu se přihlas a zvol Nahrát zálohu.
3. Vyber stažený JSON. Import stačí jednou; existující ID se přeskočí a novější online zápisky se nepřepisují. Záloha má nejvýše 5 MB a 1 000 knih.

Na iPhonu otevři online adresu v Safari → Sdílet → Přidat na plochu → Otevřít jako webovou aplikaci. Každá kniha má vlastní odkaz s parametrem book, který funguje i po obnovení stránky na GitHub Pages.

## Nasazení

1. V samostatném projektu Supabase aplikuj schéma v souboru supabase/schema.sql. Schéma je již aplikované v připraveném projektu Dračí archiv.
2. V Authentication → URL Configuration nastav Site URL na cílovou adresu aplikace.
3. V GitHub Actions Variables nastav VITE_SUPABASE_URL a VITE_SUPABASE_PUBLISHABLE_KEY (moderní sb_publishable_ klíč, nikdy service_role, sb_secret_ ani heslo databáze).
4. Settings → Pages → Source: GitHub Actions. Workflow Publish Dračí archiv kontroluje typy, testy a sestavení, poté nasadí dist-pages.
5. GitHub Pages na tarifu Free vyžaduje veřejný repozitář. Změna viditelnosti zdrojů vyžaduje samostatné schválení vlastníka. Knihovna zůstává v Supabase za přihlášením.

## Vývoj a ověření

Node.js 24 a npm. Instalace: npm ci. Kontroly: npm run typecheck, npm run test:cloud. Sestavení: nastav veřejné proměnné Supabase a spusť npm run build:pages. PAGES_BASE_PATH má výchozí hodnotu /draci-archiv/.

Testy ověřují společná data dvou klientů, ochranu před zastaralým uložením a smazáním, opakovatelný import i odkazy a obrázky v podadresáři GitHub Pages. Přímo v databázi byly transakčně ověřeny politiky vlastníka, zákaz přístupu jinému účtu, revize a prázdný výchozí stav. Testovací záznamy byly vráceny zpět transakcí. Kontrola Supabase security advisors nehlásí nedostatky schématu.

## Zachovaná místní a serverová varianta

tools/build-local.mjs vytváří původní samostatné HTML s ukládáním pouze v konkrétním prohlížeči. Má stejný formát zálohy i klíč místního úložiště; nepoužívá Supabase. Zdrojová varianta Vinext / Sites s D1 je zachovaná pro případ budoucího použití, ale GitHub Pages ji nespouští.

## Obrázky

Online web používá pouze dragon-library.webp, reading-sticker.webp a ikony aplikace. Původní referenční fotografie a velké PNG soubory zůstávají mimo repozitář.
