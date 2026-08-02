#!/usr/bin/env python3
"""Build and cache forward and reverse graphs from matching Wikipedia SQL dumps."""

import gzip
import os
import pickle
import time
from collections import defaultdict

PAGE_DUMP       = "enwiki-latest-page.sql.gz"
LINKTARGET_DUMP = "enwiki-latest-linktarget.sql.gz"
PAGELINKS_DUMP  = "enwiki-latest-pagelinks.sql.gz"
GRAPH_CACHE     = "wiki_graph.pkl"

EXCLUDE_PREFIXES = ("List_of_", "Lists_of_", "Index_of_", "Outline_of_")
EXCLUDE_SUFFIXES = ("_(disambiguation)",)


def is_valid_title(title):
    for p in EXCLUDE_PREFIXES:
        if title.startswith(p):
            return False
    for s in EXCLUDE_SUFFIXES:
        if title.endswith(s):
            return False
    return True


def parse_sql_rows(path):
    with gzip.open(path, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            if not line.startswith("INSERT INTO"):
                continue
            idx = line.find(" VALUES ")
            if idx == -1:
                continue
            yield from _split_rows(line[idx + 8:])


def _split_rows(s):
    i = 0
    n = len(s)
    while i < n:
        if s[i] != '(':
            i += 1
            continue
        i += 1
        fields = []
        buf = []
        in_str = False
        esc = False
        while i < n:
            c = s[i]
            if esc:
                buf.append(c)
                esc = False
            elif in_str and c == '\\':
                esc = True
            elif not in_str and c == "'":
                in_str = True
            elif in_str and c == "'":
                in_str = False
            elif not in_str and c == ',':
                fields.append(''.join(buf))
                buf = []
            elif not in_str and c == ')':
                fields.append(''.join(buf))
                yield fields
                break
            else:
                buf.append(c)
            i += 1
        i += 1


def load_pages(path):
    print(f"Reading {path} ...")
    pages = {}
    for i, row in enumerate(parse_sql_rows(path)):
        if len(row) < 4:
            continue
        try:
            pid      = int(row[0])
            ns       = int(row[1])
            title    = row[2]
            redirect = int(row[3])
        except (ValueError, IndexError):
            continue
        if ns == 0 and redirect == 0 and is_valid_title(title):
            pages[pid] = title
        if (i + 1) % 2_000_000 == 0:
            print(f"  {i+1:,} rows  {len(pages):,} articles")
    print(f"  done: {len(pages):,} valid articles")
    return pages


def load_linktarget(path, pages):
    print(f"Reading {path} ...")
    title_to_id = {title: pid for pid, title in pages.items()}
    lt_map = {}
    for i, row in enumerate(parse_sql_rows(path)):
        if len(row) < 3:
            continue
        try:
            lt_id = int(row[0])
            ns    = int(row[1])
            title = row[2]
        except (ValueError, IndexError):
            continue
        if ns == 0:
            pid = title_to_id.get(title)
            if pid is not None:
                lt_map[lt_id] = pid
        if (i + 1) % 5_000_000 == 0:
            print(f"  {i+1:,} rows  {len(lt_map):,} mapped")
    print(f"  done: {len(lt_map):,} targets mapped")
    return lt_map


def build_forward_graph(path, valid_ids, lt_map):
    print(f"Reading {path} ...")
    adjacency = {}
    edges = 0
    for i, row in enumerate(parse_sql_rows(path)):
        if len(row) < 3:
            continue
        try:
            src    = int(row[0])
            src_ns = int(row[1])
            lt_id  = int(row[2])
        except (ValueError, IndexError):
            continue
        if src_ns != 0 or src not in valid_ids:
            continue
        dst = lt_map.get(lt_id)
        if dst is None or dst == src:
            continue
        if src not in adjacency:
            adjacency[src] = set()
        adjacency[src].add(dst)
        edges += 1
        if (i + 1) % 20_000_000 == 0:
            print(f"  {i+1:,} rows  {edges:,} edges")
    forward = {k: list(v) for k, v in adjacency.items()}
    print(f"  done: {edges:,} edges across {len(forward):,} pages")
    return forward


def build_reverse_from_forward(forward):
    print("Building reverse graph from forward graph ...")
    reverse = defaultdict(list)
    for src, neighbors in forward.items():
        for dst in neighbors:
            reverse[dst].append(src)
    reverse = dict(reverse)
    print(f"  done: {len(reverse):,} pages with incoming links")
    return reverse


def main():
    t0 = time.time()

    if os.path.exists(GRAPH_CACHE):
        print(f"Loading {GRAPH_CACHE} ...")
        with open(GRAPH_CACHE, "rb") as f:
            data = pickle.load(f)

        has_pages   = 'pages'   in data
        has_forward = 'forward' in data
        has_reverse = 'reverse' in data

        if has_pages and has_forward and has_reverse:
            print(f"  pages:   {len(data['pages']):,}")
            print(f"  forward: {len(data['forward']):,} pages")
            print(f"  reverse: {len(data['reverse']):,} pages")
            print("Cache is complete. Nothing to do.")
            return

        # Complete a partially generated cache.
        pages   = data.get('pages')
        forward = data.get('forward')
        reverse = data.get('reverse')

        if pages is None:
            pages = load_pages(PAGE_DUMP)

        if forward is None:
            lt_map  = load_linktarget(LINKTARGET_DUMP, pages)
            forward = build_forward_graph(PAGELINKS_DUMP, set(pages.keys()), lt_map)
            del lt_map

        if reverse is None:
            reverse = build_reverse_from_forward(forward)

    else:
        pages   = load_pages(PAGE_DUMP)
        lt_map  = load_linktarget(LINKTARGET_DUMP, pages)
        forward = build_forward_graph(PAGELINKS_DUMP, set(pages.keys()), lt_map)
        del lt_map
        reverse = build_reverse_from_forward(forward)

    print(f"Saving {GRAPH_CACHE} ...")
    with open(GRAPH_CACHE, "wb") as f:
        pickle.dump(
            {"pages": pages, "forward": forward, "reverse": reverse},
            f,
            protocol=pickle.HIGHEST_PROTOCOL,
        )
    print(f"  saved. ({time.time() - t0:.0f}s total)")


if __name__ == "__main__":
    main()
