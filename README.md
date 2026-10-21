# Liškaplikace

## PROD a TEST

- PROD: https://kordic99.github.io/liskaplikace/ — větev `main`, přihlášení a soukromé knihovny v Supabase.
- TEST: https://kordic99.github.io/liskaplikace/test/ — větev `test`, bez přihlášení, samostatná zkušební data v localStorage a obrázky v IndexedDB. Nesynchronizuje se mezi PC a telefonem. Vymazání dat prohlížeče smaže i TEST; lze použít JSON zálohu.

Nové změny se vyvíjejí a nejdřív nasazují na `test`. Přesun do `main` po ověření znamená vydání do PRODu; testovací uživatelská data se nepřesouvají. Workflow sestaví každou verzi z její vlastní větve a publikuje je společně, aby testovací nasazení nesmazalo PROD. Do TESTu se nepředávají produkční údaje Supabase; sestavení je odmítne. TEST má vlastní cesty, manifest a výrazný fialový pruh. Google Books + Open Library zůstávají vyhledávacími zdroji v obou prostředích. Vlastní společný katalog zatím není zavedený; jeho návrh a zdroje dat jsou budoucí práce v TESTu.

Při prvním založení prostředí musí existovat obě větve se zdroji podporujícími tento workflow. Pro lokální TEST použij `APP_ENV=test`, `PAGES_BASE_PATH=/liskaplikace/test/`, `VITE_GOOGLE_BOOKS_API_KEY` a `node tools/build-pages.mjs`; proměnné Supabase musí být prázdné. Výstup je `dist-pages-test`. PROD používá stávající `dist-pages`. Spojení ověřuje `node tools/assemble-pages.mjs <prod-output> <test-output> <empty-output>`.

## Vlastní obálky

V editoru knihy lze nahrát JPG, PNG, WebP nebo HEIC do 20 MB, pokud formát dokáže otevřít prohlížeč. Obrázek se převede na JPEG nejvýše 600 × 900 px / 256 kB. Původní adresa `cover` zůstává a soukromá varianta používá pole `customCover`; starší knihy dostanou prázdnou hodnotu automaticky. Vrácení původní obálky neovlivní ostatní údaje knihy.

PROD vyžaduje jednorázové použití `supabase/book-covers.sql` (v projektu Liškaplikace již provedeno). Bucket `book-covers` je soukromý. RLS povoluje čtení a nové nahrání pouze vlastníkovi ve složce jeho účtu; obrázky se nepřepisují a nejsou veřejně dostupné. Starší obrázky se zachovávají pro kompatibilitu záloh. TEST ukládá obrázky samostatně pouze v prohlížeči. Zálohy obsahují `coverImages` s obrázky, celkově nejvýše 5 MB; při importu se vytvoří nové soukromé soubory v cílovém účtu či místním úložišti. Import nepřepisuje existující knihy.

Kontroly navíc: `npm run test:covers`. SQL test `tests/cover-storage-rls.sql` ověřuje oddělení dvou dočasných účtů v transakci zakončené ROLLBACK.

Osobní čtenářská knihovna pro počítač i iPhone. Přehled knih, TBR, zápisky, citáty, postavy, hodnocení a nákupní list se čtyřmi motivy nastavitelnými pro každý účet. Samolepka je nahoře u uvítání, mobil má spodní navigaci a podporu přidání na plochu.

## Online verze

GitHub Pages poskytuje aplikaci a Supabase zajišťuje přihlášení i data každého účtu. Cílová adresa: https://kordic99.github.io/liskaplikace/

Původní adresa `/draci-archiv/` přesměrovává na `/liskaplikace/` a zachovává odkaz na knihu i návrat z přihlašovacího e-mailu. Zdrojový repozitář je `Kordic99/liskaplikace`.

Na počítači i telefonu použij **stejný účet aplikace**. Účet v administraci Supabase je jiný než přihlášení do Liškaplikace. Nejdřív si jednou vytvoř účet v aplikaci a potvrď e-mail, pokud to Supabase vyžaduje.

Data jsou chráněná Row Level Security: každý účet čte a mění jen své knihy a nastavení v `archive_preferences`. V aplikaci není administrátorská role ani privilegovaný účet. Správa schématu a nasazení probíhá mimo aplikaci. Nepřihlášený návštěvník nemá přístup k databázové tabulce. Klient obsahuje pouze veřejný publishable klíč. Soukromé knihy, zápisky, hesla ani zálohy se do GitHubu neukládají.

Změny se načítají přes Supabase Realtime, při návratu do okna a každých 15 sekund při otevřené aplikaci. Ukládání i odstranění kontroluje revizi knihy, aby starší zařízení nepřepsalo novější obsah. Při otevřeném editoru se automatické nahrazování dat pozastaví. Chyba uložení ponechá formulář otevřený. K ukládání je potřeba internet; fronta pro ukládání bez internetu není implementovaná. Rozpracovaný formulář před zavřením stránky ulož nebo si zkopíruj jeho text.

## Vyhledávání knih

Přidávání knih vyhledává přes Google Books a Open Library. Google Books hledá nejprve česká vydání; pokud žádná nenajde, zkusí všechny jazyky. Volbou „Hledat i v jiných jazycích“ lze jazykové omezení vypnout rovnou. ISBN dotaz hledá konkrétní vydání bez jazykového omezení. Open Library češtinu upřednostňuje. Každý zdroj má vlastní blok výsledků; pořadí Google Books se zachovává. Záznamy Open Library, jejichž ověřené ISBN odpovídá zobrazenému vydání Google Books, se neopakují. Rozdílná ISBN nebo známé různé jazyky zůstávají oddělené.

Předvyplňuje se název, autor, obálka, ISBN, počet stran a dostupná anotace. U Open Library se po výběru načtou údaje konkrétního vydání; souhrnné ISBN, medián počtu stran a rok prvního vydání díla se nepoužívají. Doplňování vybraného výsledku Google Books z Open Library vyžaduje shodné ISBN. Při nedostupnosti jednoho katalogu zůstává druhý dostupný s vysvětlením; při výpadku obou je možné ruční přidání. Úspěšné dotazy se dočasně uchovávají jen v paměti prohlížeče (5 minut, nejvýše 30 dotazů). Katalogy dostávají vyhledávací dotaz, nikoli soukromé zápisky či obsah knihovny.

Pro produkční sestavení je potřeba `VITE_GOOGLE_BOOKS_API_KEY` v GitHub Actions Variables. Je to klíč používaný veřejným webem: omezit na Books API a HTTP referrery `https://kordic99.github.io/*`; pro testovací náhled také `http://127.0.0.1:5194/*`. Hodnota nepatří do zdrojových souborů. Projekt Google Cloud ponechat bez připojené fakturace. Dostupnost kvóty se ověřuje v konzoli; její vyčerpání se v aplikaci řeší pokračováním přes Open Library, automatické placené navýšení aplikace nezavádí.

## Poličky a motivy

Každá kniha patří právě do jedné poličky: Přečtené, Právě čtu nebo TBR. Dřívější Odložené se slučuje do TBR; stejné pravidlo platí při importu starých záloh a zápisu ze staršího klienta. Nákupní list je nezávislé označení knihy.

Přečtené knihy lze filtrovat podle roku a měsíce dočtení, společně s hledáním názvu, autora a štítků. Datum lze opravit v úpravě knihy; volba Bez data najde knihy, které ho zatím nemají.

V Nastavení jsou motivy Dračí knihovna, Liščí podzim, Lesní útočiště a Měsíční noc. Karty motivů zobrazují náhled skutečné ilustrace; každý ze čtyř motivů má vlastní hlavní obrázek. Motiv a zobrazení samolepky se ukládají k účtu a načítají na dalších zařízeních. Revize chrání i nastavení před přepsáním starším zařízením.

## Novinky po přihlášení

Při otevření přihlášené knihovny se načte aktuální veřejný seznam vydání `releases.json` a soukromý stav účtu z `archive_release_reads`. Uživatel dostane v jednom okně všechny aktualizace, které ještě nepotvrdil, včetně součtu novinek. Účty mají nezávislé hranice přečtených vydání; potvrzení je společné pro PC a telefon. Přihlášení ani samotné otevření okna změny neoznačí jako přečtené. Potvrzení se uloží teprve zavřením okna; při chybě lze opakovat pokus nebo zvolit připomenutí příště.

Otevřené okno zachovává svůj seznam změn: aktualizace vydaná během čtení se neoznačí za přečtenou omylem. Monotónní databázový zápis zabrání staršímu zařízení vrátit potvrzení zpět. Okno počká na dokončení jiného otevřeného editoru. Při návratu do aplikace se stav znovu ověří; obnovení přihlašovacího tokenu samo okno znovu neotevírá. Novější veřejný seznam pozná i starší otevřená verze; po potvrzení nabídne načtení nové aplikace. Historie je dostupná v Nastavení.

Při prvním použití této funkce účet dostane úvodní přehled posledních zaznamenaných změn; dřívější návštěvy se zpětně neodhadují. Každá další změna zdroje musí přidat pravdivou položku do `app/releases.json` s dalším číselným ID. Publikované položky se nemění. CI porovnává seznam s posledním úspěšně nasazeným vydáním a při chybějících novinkách nasazení zastaví; opakované nasazení stejného sestavení nové oznámení nevytváří. Viz `AGENTS.md`.

## Přenos původní knihovny

1. V původním místním HTML zvol Zálohovat knihovnu.
2. V online archivu se přihlas a zvol Nahrát zálohu.
3. Vyber stažený JSON. Import stačí jednou; existující ID se přeskočí a novější online zápisky se nepřepisují. Záloha má nejvýše 5 MB a 1 000 knih.

Na iPhonu otevři online adresu v Safari → Sdílet → Přidat na plochu → Otevřít jako webovou aplikaci. Každá kniha má vlastní odkaz s parametrem book, který funguje i po obnovení stránky na GitHub Pages.

## Nasazení

1. V samostatném projektu Supabase aplikuj `supabase/schema.sql`, `supabase/preferences.sql` a `supabase/release-notices.sql`. Aktualizace existujícího projektu používá pouze chybějící dílčí skripty `supabase/preferences.sql`, `supabase/merge-tbr.sql` a `supabase/release-notices.sql` (nezaváděj znovu tabulku knih). Schéma je již aplikované v připraveném projektu Liškaplikace.
2. V Authentication → URL Configuration nastav Site URL na cílovou adresu aplikace.
3. V GitHub Actions Variables nastav VITE_SUPABASE_URL a VITE_SUPABASE_PUBLISHABLE_KEY (moderní sb_publishable_ klíč, nikdy service_role, sb_secret_ ani heslo databáze) a VITE_GOOGLE_BOOKS_API_KEY podle části Vyhledávání knih.
4. Settings → Pages → Source: GitHub Actions. Workflow Publish Liškaplikace kontroluje typy, testy a sestavení, poté nasadí dist-pages.
5. GitHub Pages na tarifu Free vyžaduje veřejný repozitář. Změna viditelnosti zdrojů vyžaduje samostatné schválení vlastníka. Knihovna zůstává v Supabase za přihlášením.

## Vývoj a ověření

Node.js 24 a npm. Instalace: npm ci. Kontroly: npm run typecheck, npm run test:cloud, npm run test:catalog, npm run test:releases a `node tools/check-releases.mjs`. Po úpravě pevných barev v archive.css/cloud.css spusť `node tools/sync-theme-palette.mjs` pro obnovu barev motivů. Sestavení: nastav veřejné proměnné Supabase a Google Books a spusť npm run build:pages. PAGES_BASE_PATH má výchozí hodnotu /liskaplikace/.

Testy ověřují data každého účtu dvou klientů, ochranu před zastaralým uložením a smazáním, opakovatelný import i odkazy a obrázky v podadresáři GitHub Pages. Přímo v databázi byly transakčně ověřeny politiky vlastníka, zákaz přístupu jinému účtu, revize a prázdný výchozí stav. Testovací záznamy byly vráceny zpět transakcí. Test `tests/rls-isolation.sql` lze spustit v migrované databázi; vytvořené zkušební účty a data se vrátí zpět pomocí ROLLBACK. Kontrola security advisors nehlásí nedostatky RLS. Projekt má upozornění na vypnutou kontrolu uniklých hesel (nastavení služby Auth).

## Zachovaná místní a serverová varianta

tools/build-local.mjs vytváří původní samostatné HTML s ukládáním pouze v konkrétním prohlížeči. Má stejný formát zálohy i klíč místního úložiště; nepoužívá Supabase. Zdrojová varianta Vinext / Sites s D1 je zachovaná pro případ budoucího použití, ale GitHub Pages ji nespouští.

## Obrázky

Online web používá dragon-library.webp, reading-sticker.webp, samostatné ilustrace Malého prince, živé podzimní lišky a lesní čítárny a liščí ikony aplikace. Původní referenční fotografie a velké PNG soubory zůstávají mimo repozitář.
