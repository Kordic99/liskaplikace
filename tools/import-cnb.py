"""Bounded, manual import of CC0 bibliographic metadata; never fetch images/texts.

Run from the repository: python tools/import-cnb.py --from-date YYYY-MM-DD
Only CNB's official OAI-PMH set is accepted. Raw responses stay ignored locally.
"""
import argparse
import datetime as dt
import hashlib
import json
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENDPOINT = "https://aleph.nkp.cz/OAI"
NS = {"o": "http://www.openarchives.org/OAI/2.0/", "m": "http://www.loc.gov/MARC21/slim"}
LICENSE_URL = "https://www.nkp.cz/file/e1004214bf3f3013c6cd35b1ac8b3af4/2690/prohlaseni_nk_opendata.pdf"


def clean(value):
    return re.sub(r"\s+", " ", value or "").strip().rstrip(" /:;,").strip()


def isbn(value):
    value = re.sub(r"[\s-]", "", value).upper()
    if re.fullmatch(r"\d{9}[\dX]", value):
        if sum((10 if c == "X" else int(c)) * (10-i) for i, c in enumerate(value)) % 11:
            return ""
        value = "978" + value[:9]
        value += str((-sum(int(c) * (1 if i % 2 == 0 else 3) for i, c in enumerate(value))) % 10)
    if not re.fullmatch(r"97[89]\d{10}", value):
        return ""
    return value if sum(int(c) * (1 if i % 2 == 0 else 3) for i, c in enumerate(value)) % 10 == 0 else ""


def edition(record):
    header = record.find("o:header", NS)
    if header is None or header.get("status") == "deleted":
        return None
    marc = record.find("o:metadata/m:record", NS)
    if marc is None:
        return None
    def fields(tag, code):
        return [clean(x.text) for x in marc.findall(f"m:datafield[@tag='{tag}']/m:subfield[@code='{code}']", NS) if x.text]
    def first(tag, code):
        return next(iter(fields(tag, code)), "")
    leader = marc.findtext("m:leader", "", NS)
    if len(leader) < 8 or leader[6] != "a" or leader[7] != "m":
        return None
    record_id, title = first("015", "a"), first("245", "a")
    if not re.fullmatch(r"cnb\d{6,12}", record_id) or not title:
        return None
    subtitle = first("245", "b")
    if subtitle:
        title += ": " + subtitle
    # Named parts must not collapse distinct volumes into one title.
    parts = fields("245", "n") + fields("245", "p")
    if parts:
        title = title.rstrip(".") + ". " + ". ".join(parts)
    names = fields("100", "a") or fields("110", "a")
    for node in marc.findall("m:datafield[@tag='700']", NS):
        roles = [x.text for x in node.findall("m:subfield[@code='4']", NS)]
        if "aut" in roles:
            names += [clean(x.text) for x in node.findall("m:subfield[@code='a']", NS) if x.text]
    dates = first("264", "c") or first("260", "c")
    year_match = re.search(r"\b(1[4-9]\d{2}|20\d{2}|21\d{2})\b", dates)
    fixed = marc.findtext("m:controlfield[@tag='008']", "", NS)
    lang = first("041", "a") or (fixed[35:38] if len(fixed) >= 38 else "")
    lang = {"cze": "cs", "ces": "cs", "eng": "en", "slo": "sk", "slk": "sk", "ger": "de", "deu": "de"}.get(lang, lang)
    # Only unambiguous page extents; volumes or audio durations are not pages.
    extent = first("300", "a")
    page_match = re.fullmatch(r"(\d{1,5})\s*(?:s\.|stran|strany|strana)\.?", extent)
    ids = list(dict.fromkeys(filter(None, (isbn(x) for x in fields("020", "a")))))
    return {
        "id": "cnb:" + record_id, "title": title[:300], "author": "; ".join(dict.fromkeys(names))[:300],
        "isbns": ids[:10], "year": int(year_match[1]) if year_match else None,
        "language": lang[:20], "publisher": (first("264", "b") or first("260", "b"))[:300],
        "edition": first("250", "a")[:200], "pages": int(page_match[1]) if page_match else 0,
        "series": "; ".join(fields("490", "a"))[:200], "publicationStatus": "published",
        "origin": {"kind": "cnb", "recordId": record_id, "license": "CC0-1.0",
                   "url": "https://aleph.nkp.cz/F/?func=find-c&local_base=CNB&ccl_term=" + urllib.parse.quote("cnb=" + record_id),
                   "updatedAt": header.findtext("o:datestamp", "", NS)},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from-date", default=(dt.date.today()-dt.timedelta(days=30)).isoformat())
    parser.add_argument("--limit", type=int, default=500)
    parser.add_argument("--max-pages", type=int, default=40)
    args = parser.parse_args()
    dt.date.fromisoformat(args.from_date)
    if not 1 <= args.limit <= 5000 or not 1 <= args.max_pages <= 100:
        parser.error("Limit must be 1..5000 and max-pages 1..100")
    cache = ROOT / ".sites-runtime" / "cnb-import"
    cache.mkdir(parents=True, exist_ok=True)
    records, receipts, token = {}, [], ""
    for page in range(args.max_pages):
        params = {"verb": "ListRecords", "resumptionToken": token} if token else {"verb": "ListRecords", "metadataPrefix": "marc21", "set": "CNB", "from": args.from_date}
        url = ENDPOINT + "?" + urllib.parse.urlencode(params)
        request = urllib.request.Request(url, headers={"User-Agent": "Liskaplikace-CC0-catalog-pilot/1.0 (bounded manual import)"})
        with urllib.request.urlopen(request, timeout=45) as response:
            if response.url.split("?")[0] != ENDPOINT:
                raise RuntimeError("Unexpected OAI redirect")
            raw = response.read(5_000_001)
        if len(raw) > 5_000_000:
            raise RuntimeError("OAI page exceeded the 5 MB limit")
        (cache / f"page-{page+1:03}.xml").write_bytes(raw)
        document = ET.fromstring(raw)
        errors = document.findall("o:error", NS)
        if errors:
            raise RuntimeError("; ".join(x.text or x.get("code", "") for x in errors))
        for record in document.findall("o:ListRecords/o:record", NS):
            item = edition(record)
            if item is not None:
                records[item["id"]] = item
                if len(records) >= args.limit:
                    break
        receipts.append({"url": url, "sha256": hashlib.sha256(raw).hexdigest()})
        print(f"Page {page+1}: {len(records)} monograph records", flush=True)
        token = document.findtext("o:ListRecords/o:resumptionToken", "", NS)
        if len(records) >= args.limit or not token:
            break
        time.sleep(0.8)
    if not records:
        raise RuntimeError("No eligible records; existing seed was not replaced")
    items = sorted(records.values(), key=lambda x: x["id"])
    digest = hashlib.sha256(json.dumps(items, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    result = {"format": "liskaplikace-cnb-seed-v1", "version": digest, "importedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
              "source": {"name": "Česká národní bibliografie – NK ČR", "license": "CC0-1.0", "licenseUrl": LICENSE_URL,
                         "documentationUrl": "https://www.nkp.cz/o-knihovne/odborne-cinnosti/otevrena-data", "fromDate": args.from_date,
                         "scope": "Omezený vzorek monografií podle data změny záznamu, nikoli kompletní katalog nebo seznam novinek.", "receipts": receipts},
              "editions": items}
    target = ROOT / "data" / "cnb-seed.json"
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"Saved {len(items)} editions to {target}")


if __name__ == "__main__":
    main()
