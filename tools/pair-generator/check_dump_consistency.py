#!/usr/bin/env python3
"""Check whether the Wikipedia SQL inputs appear to come from one dump snapshot."""

import sys
from graph_generator import parse_sql_rows

PAGE_DUMP       = "enwiki-latest-page.sql.gz"
LINKTARGET_DUMP = "enwiki-latest-linktarget.sql.gz"
PAGELINKS_DUMP  = "enwiki-latest-pagelinks.sql.gz"

SAMPLE_ROWS = 2_000_000  # linktarget/pagelinks are huge, a sample is enough to catch a mismatch


def load_page_ids_and_titles(path):
    print(f"Reading {path} (full file, this is the slow part) ...")
    ids    = set()
    titles = set()
    for i, row in enumerate(parse_sql_rows(path)):
        if len(row) < 4:
            continue
        try:
            pid   = int(row[0])
            ns    = int(row[1])
            title = row[2]
        except (ValueError, IndexError):
            continue
        ids.add(pid)
        if ns == 0:
            titles.add(title)
        if (i + 1) % 2_000_000 == 0:
            print(f"  {i+1:,} rows read, {len(ids):,} page ids so far")
    print(f"  done: {len(ids):,} total page ids, {len(titles):,} mainspace titles")
    return ids, titles


def sample_pagelinks_source_ids(path, n):
    print(f"Sampling first {n:,} rows of {path} ...")
    ids = []
    for i, row in enumerate(parse_sql_rows(path)):
        if i >= n:
            break
        if len(row) < 3:
            continue
        try:
            ids.append(int(row[0]))
        except ValueError:
            continue
    print(f"  sampled {len(ids):,} pl_from ids")
    return ids


def sample_linktarget_titles(path, n):
    print(f"Sampling first {n:,} rows of {path} ...")
    titles = []
    for i, row in enumerate(parse_sql_rows(path)):
        if i >= n:
            break
        if len(row) < 3:
            continue
        try:
            ns = int(row[1])
        except (ValueError, IndexError):
            continue
        if ns == 0:
            titles.append(row[2])
    print(f"  sampled {len(titles):,} mainspace link targets")
    return titles


def main():
    for path in (PAGE_DUMP, LINKTARGET_DUMP, PAGELINKS_DUMP):
        try:
            open(path, "rb").close()
        except FileNotFoundError:
            print(f"ERROR: {path} not found in this folder.")
            sys.exit(1)

    page_ids, page_titles = load_page_ids_and_titles(PAGE_DUMP)
    max_page_id = max(page_ids)
    print(f"\nmax page id in {PAGE_DUMP}: {max_page_id:,}\n")

    pl_ids = sample_pagelinks_source_ids(PAGELINKS_DUMP, SAMPLE_ROWS)
    hits      = sum(1 for pid in pl_ids if pid in page_ids)
    miss_pct  = 100 * (len(pl_ids) - hits) / len(pl_ids) if pl_ids else 0
    max_pl_id = max(pl_ids) if pl_ids else 0
    print(f"pagelinks pl_from ids found in page dump: {hits:,}/{len(pl_ids):,} ({100 - miss_pct:.1f}%)")
    print(f"highest pl_from id sampled: {max_pl_id:,} (vs max page id {max_page_id:,})")
    if max_pl_id > max_page_id * 1.02:
        print("  -> pagelinks references page ids the page dump has never heard of.")
        print("  -> pagelinks looks NEWER than page.sql.gz.")

    lt_titles = sample_linktarget_titles(LINKTARGET_DUMP, SAMPLE_ROWS)
    lt_hits = sum(1 for t in lt_titles if t in page_titles)
    lt_hit_pct = 100 * lt_hits / len(lt_titles) if lt_titles else 0
    print(f"\nlinktarget mainspace titles found as real pages: {lt_hits:,}/{len(lt_titles):,} ({lt_hit_pct:.1f}%)")
    print("(some misses are normal, those are redlinks to articles that don't exist. a lot of misses means a mismatch.)")

    print("\n--- verdict ---")
    if miss_pct > 5:
        print(f"pagelinks and page.sql.gz disagree on {miss_pct:.1f}% of sampled source ids.")
        print("That's too high for normal daily churn. These are very likely different dump runs.")
        print("Re-download all three files from the same dated folder, not /latest/, since /latest/")
        print("can point to a run that's still in progress and mix pieces from two different dates:")
        print("  https://dumps.wikimedia.org/enwiki/  -> pick one YYYYMMDD folder, get all three from it")
    else:
        print(f"pagelinks and page.sql.gz agree on source ids ({100 - miss_pct:.1f}% match). This pair looks consistent.")


if __name__ == "__main__":
    main()
