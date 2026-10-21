# Vlastní katalog – TEST

`cnb-seed.json` je omezený vzorek **500 monografických záznamů** České národní bibliografie (ČNB), importovaný 21. 10. 2026 prostřednictvím oficiálního OAI-PMH rozhraní. Dotaz vybíral záznamy změněné od 20. 10. 2026. Datum změny není datem vydání; vzorek není úplný katalog ani reprezentativní seznam novinek. Přítomnost ISBN není podmínkou.

## Původ a oprávnění

- Poskytovatel: Národní knihovna České republiky.
- [Otevřená data a dokumentace](https://www.nkp.cz/o-knihovne/odborne-cinnosti/otevrena-data).
- Režim databáze: **CC0 1.0 Universal**.
- [Výslovné prohlášení NK ČR pro ČNB](https://www.nkp.cz/file/e1004214bf3f3013c6cd35b1ac8b3af4/2690/prohlaseni_nk_opendata.pdf).
- [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

Přebírá se jen vymezený seznam bibliografických polí: identifikátor ČNB, název a označení části, autor, ISBN, rok, jazyk, nakladatel, vydání, jednoznačně uvedený počet stran a série. Nepřebírají se anotace, obálky, recenze, celé texty, fotografie ani obsah odkazovaných stránek. Odkazy z MARC 856 se neprocházejí. Každé vydání má identifikátor zdroje a datum změny; obálku vytváří stávající grafický návrh aplikace.

Manifest obsahuje rozsah dotazu, čas importu a SHA-256 surových odpovědí. Surové XML jsou pouze v ignorovaném `.sites-runtime/cnb-import/`. Výslovná CC0 se vztahuje na uvedenou databázi; nepovažujeme ji za souhlas k přebírání dalšího obsahu z webů.

## Opakování importu

Z kořene repozitáře spusť `python tools/import-cnb.py --from-date YYYY-MM-DD --limit 500 --max-pages 40`. Skript využívá standardní knihovnu Pythonu, omezuje počet dotazů, velikost odpovědí a mezi stránkami čeká. Spouští se ručně; CI ani návštěvníci nestahují data z NK ČR. OAI-PMH při dalším importu může vrátit jiná data. Import aktualizuje pouze základ katalogu, nikoli uživatelské opravy nebo knihovny.

## Ukládání a hranice prototypu

Pouze vstupní bod TESTu registruje vlastní katalog. PROD se sestavuje ze samostatné větve a nadále používá své vyhledávání. TEST nevyžaduje klíč Google Books ani konfiguraci Supabase. Katalog nepřidává placenou službu, účet ani API účtované za dotazy.

Databáze IndexedDB `liskaplikace-test-v1-catalog` má oddělené objekty `seed`, `changes` a `meta`. Aktualizace importu nahrazuje pouze `seed`; uživatelské změny jsou samostatné opravy konkrétních polí. Změny kontrolují revizi proti souběžně otevřenému editoru. ČNB záznamy se slučují pouze stabilním identifikátorem ČNB; shodný název ani ISBN automaticky neslučuje různá vydání. Vlastní záznamy mají UUID a ISBN je nepovinné.

Záloha katalogu (`liskaplikace-own-catalog-v1`) obsahuje pouze vlastní záznamy a opravy. Při obnově se existující ID nepřepisují; opravy k chybějícím záznamům jiného vzorku se přeskočí. Osobní knihovna, zápisky, hodnocení a soukromé obálky se zálohují zvlášť. Výmaz dat prohlížeče odstraní místní doplnění; automatická synchronizace mezi zařízeními a uživateli není součástí tohoto bezplatného prototypu.

Kontroly: `npm run test:own-catalog`, ostatní předepsané kontroly v `AGENTS.md` a prohlížečové ověření uložení, obnovy a oddělení od knihovny.
