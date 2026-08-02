#!/usr/bin/env python3
"""Build the Higher or Lower article catalog from pageviews and incoming links."""

import json
import os
import pickle
import re

GRAPH_CACHE     = "wiki_graph.pkl"
PAGEVIEWS_CACHE = "pageviews_cache.pkl"
OUTPUT_FILE     = "higherlower_articles.json"
TARGET_COUNT    = 5000
POOL_MULTIPLIER = 4    # views-based buffer before re-ranking by incoming links

# Reserve part of the catalog for current popularity so recent topics are not
# displaced solely because they have accumulated fewer incoming links.
VIEWS_BUCKET_FRACTION = 0.35

# Exclude structural pages that attract traffic without being useful game topics.
YEAR_RE       = re.compile(r'^\d{3,4}$')
MONTHS        = ('January', 'February', 'March', 'April', 'May', 'June', 'July',
                  'August', 'September', 'October', 'November', 'December')
MONTH_YEAR_RE = re.compile(r'^(' + '|'.join(MONTHS) + r')_\d{4}$')

EXCLUDE_EXACT = {
    'Main_Page',
}
EXCLUDE_PREFIXES = ('List_of_', 'Lists_of_', 'Index_of_', 'Outline_of_', 'Timeline_of_', 'Deaths_in_')
EXCLUDE_SUFFIXES = ('_(disambiguation)',)


def is_higherlower_candidate(title):
    if title in EXCLUDE_EXACT:
        return False
    if YEAR_RE.match(title) or MONTH_YEAR_RE.match(title):
        return False
    for p in EXCLUDE_PREFIXES:
        if title.startswith(p):
            return False
    for s in EXCLUDE_SUFFIXES:
        if title.endswith(s):
            return False
    if len(title) < 3:
        return False
    return True


def main():
    if not os.path.exists(GRAPH_CACHE):
        print(f"ERROR: {GRAPH_CACHE} not found. Run graph_generator.py first.")
        return
    if not os.path.exists(PAGEVIEWS_CACHE):
        print(f"ERROR: {PAGEVIEWS_CACHE} not found. Run pair_generator.py first -- it builds this cache.")
        return

    print(f"Loading {GRAPH_CACHE} ...")
    with open(GRAPH_CACHE, "rb") as f:
        graph   = pickle.load(f)
        pages   = graph["pages"]
        reverse = graph["reverse"]  # page_id -> [incoming page_ids], already computed and cached
    print(f"  {len(pages):,} valid mainspace articles")

    title_to_id = {title: pid for pid, title in pages.items()}

    print(f"Loading {PAGEVIEWS_CACHE} ...")
    with open(PAGEVIEWS_CACHE, "rb") as f:
        views = pickle.load(f)
    print(f"  {len(views):,} titles with view data")

    # Use pageviews as the initial popularity filter.
    valid_titles = set(pages.values())
    buffer_size  = TARGET_COUNT * POOL_MULTIPLIER
    by_views = sorted(
        ((title, v) for title, v in views.items() if title in valid_titles),
        key=lambda x: -x[1],
    )[:buffer_size]
    print(f"  stage 1: took top {len(by_views):,} by views as the popularity buffer")

    # Filter structural pages and calculate incoming-link counts.
    swept = 0
    candidates = []
    for title, v in by_views:
        if not is_higherlower_candidate(title):
            swept += 1
            continue
        inlinks = len(reverse.get(title_to_id.get(title), []))
        candidates.append({"title": title, "views": v, "inlinks": inlinks})
    print(f"  stage 2: swept out {swept:,} junk candidates (date pages, list pages, known anomalies)")

    # Blend current popularity with long-term incoming-link prominence.
    views_bucket_size   = int(TARGET_COUNT * VIEWS_BUCKET_FRACTION)
    inlinks_bucket_size = TARGET_COUNT - views_bucket_size

    by_views_sorted = sorted(candidates, key=lambda c: -c["views"])
    views_bucket    = by_views_sorted[:views_bucket_size]
    chosen_titles   = {c["title"] for c in views_bucket}

    remaining         = [c for c in candidates if c["title"] not in chosen_titles]
    by_inlinks_sorted = sorted(remaining, key=lambda c: -c["inlinks"])
    inlinks_bucket    = by_inlinks_sorted[:inlinks_bucket_size]

    for c in views_bucket:   c["source"] = "trending"
    for c in inlinks_bucket: c["source"] = "enduring"
    result = views_bucket + inlinks_bucket
    print(f"  stage 3: {len(views_bucket):,} kept for current popularity (top views, any inlink count)")
    print(f"  stage 3: {len(inlinks_bucket):,} kept for enduring fame (top inlinks among the rest)")

    print(f"\nFinal list: {len(result):,} articles")
    if inlinks_bucket:
        print(f"Enduring-fame inlink range: {inlinks_bucket[0]['inlinks']:,} (highest) down to {inlinks_bucket[-1]['inlinks']:,} (lowest kept)")

    print("\nTop 10 by current popularity (should look like recognizable pop culture / news):")
    for c in by_views_sorted[:10]:
        print(f"  {c['views']:>10,} views/mo  {c['inlinks']:>6,} inlinks  {c['title']}")
    print("\nTop 10 by enduring fame (should look like established, long-known topics):")
    for c in inlinks_bucket[:10]:
        print(f"  {c['inlinks']:>6,} inlinks  {c['views']:>10,} views/mo  {c['title']}")
    print("\nBottom 10 of the enduring-fame bucket (sanity check these aren't obscure junk that slipped through):")
    for c in inlinks_bucket[-10:]:
        print(f"  {c['inlinks']:>6,} inlinks  {c['views']:>10,} views/mo  {c['title']}")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=1)
    print(f"\nWrote {OUTPUT_FILE}")
    print("Upload this to the server at /var/www/wikiracr/higherlower_articles.json, then pm2 restart wikiracr")
    print("If you spot more junk in the top/bottom lists above, add it to EXCLUDE_EXACT/EXCLUDE_PREFIXES and re-run --")
    print("this only takes a few seconds since it doesn't touch the bz2 or the graph.")


if __name__ == "__main__":
    main()
