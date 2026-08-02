#!/usr/bin/env python3
"""Generate tiered WikiRacr article pairs with bidirectional breadth-first search."""

import bz2
import glob
import json
import os
import pickle
import random
import sqlite3
import time

GRAPH_CACHE      = "wiki_graph.pkl"
PAGEVIEWS_CACHE  = "pageviews_cache.pkl"
PAIRS_DB         = "pairs.db"
PAGEVIEW_DUMP    = None        # auto-detected; or set to filename explicitly
MIN_OUTBOUND     = 5

# Generation cost scales with candidate-pool size. Adjust rounds after measuring
# the first pass against the current pageview dataset.
TIERS = [
    {"name": "easy",   "min_views": 250_000, "min_depth": 2, "max_depth": 3, "rounds": 8},
    {"name": "medium", "min_views": 100_000, "min_depth": 2, "max_depth": 4, "rounds": 5},
    {"name": "hard",   "min_views": 50_000,  "min_depth": 3, "max_depth": 5, "rounds": 3},
    {"name": "expert", "min_views": 10_000,  "min_depth": 4, "max_depth": 6, "rounds": 1},
]


# Pageviews

def find_pageview_dump():
    candidates = glob.glob("pageviews-*-user.bz2") + glob.glob("pageviews-*.bz2")
    if candidates:
        candidates.sort(reverse=True)
        return candidates[0]
    return None


def load_pageviews_raw(path, title_set):
    # format (space-separated):
    #   wiki_db  article_title  null  access_type  view_count  hourly_breakdown
    # one row per (article, access_type) -- sum desktop + mobile rows
    print(f"Reading {path} ...")
    views = {}
    matched     = 0
    raw_lines   = 0
    t0          = time.time()
    last_heartbeat = t0

    with bz2.open(path, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            raw_lines += 1
            parts = line.rstrip("\n").split(" ")
            if len(parts) < 5:
                continue

            wiki  = parts[0]
            title = parts[1]
            count = parts[4]

            if wiki != "en.wikipedia":
                continue
            if title not in title_set:
                continue
            try:
                views[title] = views.get(title, 0) + int(count)
                matched += 1
            except ValueError:
                pass

            now_t = time.time()
            if raw_lines % 5_000_000 == 0 or now_t - last_heartbeat >= 30:
                elapsed = now_t - t0
                rate    = raw_lines / elapsed if elapsed > 0 else 0
                print(f"  {raw_lines:,} lines read  |  {matched:,} en.wikipedia matches  |  "
                      f"{len(views):,} titles with views so far  |  {rate:,.0f} lines/s  |  elapsed {fmt_duration(elapsed)}")
                last_heartbeat = now_t

    print(f"  done: {raw_lines:,} lines read, {len(views):,} articles with view data, {fmt_duration(time.time() - t0)} total")
    return views


def load_pageviews(path, title_set):
    if os.path.exists(PAGEVIEWS_CACHE):
        print(f"Loading cached pageviews from {PAGEVIEWS_CACHE} ...")
        with open(PAGEVIEWS_CACHE, "rb") as f:
            views = pickle.load(f)
        print(f"  loaded {len(views):,} cached view counts (delete {PAGEVIEWS_CACHE} to re-parse the dump)")
        return views

    views = load_pageviews_raw(path, title_set)
    print(f"Saving pageviews cache to {PAGEVIEWS_CACHE} ...")
    with open(PAGEVIEWS_CACHE, "wb") as f:
        pickle.dump(views, f, protocol=pickle.HIGHEST_PROTOCOL)
    return views


# Bidirectional BFS

def bidirectional_bfs(start_id, goal_id, forward, reverse, max_depth):
    if start_id == goal_id:
        return [start_id]

    fwd_visited  = {start_id: [start_id]}
    bwd_visited  = {goal_id:  [goal_id]}
    fwd_frontier = {start_id}
    bwd_frontier = {goal_id}

    for _ in range(1, max_depth + 1):
        if not fwd_frontier or not bwd_frontier:
            break

        if len(fwd_frontier) <= len(bwd_frontier):
            next_f = set()
            for page in fwd_frontier:
                for nb in forward.get(page, []):
                    if nb not in fwd_visited:
                        fwd_visited[nb] = fwd_visited[page] + [nb]
                        next_f.add(nb)
                    if nb in bwd_visited:
                        return fwd_visited[nb] + list(reversed(bwd_visited[nb]))[1:]
            fwd_frontier = next_f
        else:
            next_b = set()
            for page in bwd_frontier:
                for nb in reverse.get(page, []):
                    if nb not in bwd_visited:
                        bwd_visited[nb] = bwd_visited[page] + [nb]
                        next_b.add(nb)
                    if nb in fwd_visited:
                        return fwd_visited[nb] + list(reversed(bwd_visited[nb]))[1:]
            bwd_frontier = next_b

    return None


# Database

def init_db(path):
    conn = sqlite3.connect(path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pairs (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            start_title  TEXT    NOT NULL,
            end_title    TEXT    NOT NULL,
            path_length  INTEGER NOT NULL,
            optimal_path TEXT    NOT NULL,
            created_at   INTEGER NOT NULL,
            start_views  INTEGER,
            end_views    INTEGER,
            tier         TEXT
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_path_length ON pairs (path_length)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_tier ON pairs (tier)")

    # Migrate databases created before view counts and tiers were added.
    cols = [row[1] for row in conn.execute("PRAGMA table_info(pairs)")]
    if "start_views" not in cols:
        conn.execute("ALTER TABLE pairs ADD COLUMN start_views INTEGER")
    if "end_views" not in cols:
        conn.execute("ALTER TABLE pairs ADD COLUMN end_views INTEGER")
    if "tier" not in cols:
        conn.execute("ALTER TABLE pairs ADD COLUMN tier TEXT")

    conn.commit()
    return conn


def load_existing(conn):
    seen_pairs = set()
    for row in conn.execute("SELECT start_title, end_title FROM pairs"):
        seen_pairs.add((row[0], row[1]))
    return seen_pairs


def insert_pair(conn, start_title, end_title, path_length, path_titles, now, start_views, end_views, tier_name):
    conn.execute(
        "INSERT INTO pairs (start_title, end_title, path_length, optimal_path, created_at, start_views, end_views, tier) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (start_title, end_title, path_length, json.dumps(path_titles), now, start_views, end_views, tier_name),
    )
    conn.commit()


def report_tier_counts(conn):
    print("\nCurrent tier coverage (tagged at insert time -- what the app will actually query):")
    for tier in TIERS:
        count = conn.execute("SELECT COUNT(*) FROM pairs WHERE tier = ?", (tier["name"],)).fetchone()[0]
        print(f"  {tier['name']:8s} (>={tier['min_views']:,} views, depth {tier['min_depth']}-{tier['max_depth']}): {count:,} pairs")
    untagged = conn.execute("SELECT COUNT(*) FROM pairs WHERE tier IS NULL").fetchone()[0]
    if untagged:
        print(f"  (untagged legacy pairs, not served by any specific difficulty: {untagged:,})")


# Generation

def fmt_duration(seconds):
    if seconds < 60:
        return f"{seconds:.0f}s"
    if seconds < 3600:
        return f"{seconds/60:.1f}m"
    return f"{seconds/3600:.1f}h"


def generate_for_tier(tier, forward, reverse, pages, pageviews, conn, seen_pairs):
    name       = tier["name"]
    min_views  = tier["min_views"]
    min_depth  = tier["min_depth"]
    max_depth  = tier["max_depth"]
    rounds     = tier["rounds"]

    if rounds <= 0:
        print(f"\n=== TIER: {name} SKIPPED (rounds=0 in config) ===")
        return 0

    candidates = [
        pid for pid in pages
        if pageviews.get(pages[pid], 0) >= min_views
        and len(forward.get(pid, [])) >= MIN_OUTBOUND
    ]
    searches_per_round  = len(candidates) // 2
    planned_searches    = searches_per_round * rounds
    print(f"\n=== TIER: {name} (>={min_views:,} views, depth {min_depth}-{max_depth}) ===")
    print(f"{len(candidates):,} candidates  |  {rounds} round(s) planned  |  "
          f"~{searches_per_round:,} searches/round  |  ~{planned_searches:,} searches total for this tier")

    if len(candidates) < 4:
        print(f"  too few candidates to pair, skipping this tier")
        return 0

    tier_found     = 0
    total_searched = 0
    t0             = time.time()
    now            = int(time.time())
    last_heartbeat = t0
    HEARTBEAT_SECS = 30
    HEARTBEAT_SEARCHES = 2000

    for round_num in range(1, rounds + 1):
        random.shuffle(candidates)

        round_found      = 0
        round_searched   = 0
        round_start      = time.time()
        since_heartbeat  = 0

        print(f"  -- round {round_num}/{rounds} starting ({len(candidates):,} candidates, {searches_per_round:,} pairs to check) --")

        for i in range(0, len(candidates) - 1, 2):
            start_id = candidates[i]
            goal_id  = candidates[i + 1]

            start_title = pages[start_id]
            goal_title  = pages[goal_id]

            if (start_title, goal_title) in seen_pairs:
                continue

            path_ids = bidirectional_bfs(start_id, goal_id, forward, reverse, max_depth)
            round_searched  += 1
            since_heartbeat += 1

            if path_ids is not None:
                path_len = len(path_ids) - 1
                if min_depth <= path_len <= max_depth:
                    path_titles = [pages[pid] for pid in path_ids]
                    start_views = pageviews.get(start_title, 0)
                    end_views   = pageviews.get(goal_title, 0)
                    insert_pair(conn, start_title, goal_title, path_len, path_titles, now, start_views, end_views, name)
                    seen_pairs.add((start_title, goal_title))
                    round_found += 1
                    tier_found  += 1

            now_t = time.time()
            if now_t - last_heartbeat >= HEARTBEAT_SECS or since_heartbeat >= HEARTBEAT_SEARCHES:
                elapsed      = now_t - t0
                round_elapsed = now_t - round_start
                rate         = (total_searched + round_searched) / elapsed if elapsed > 0 else 0
                pct          = 100 * round_searched / searches_per_round if searches_per_round else 100
                remaining    = max(0, searches_per_round - round_searched)
                eta          = remaining / rate if rate > 0 else 0
                print(f"    round {round_num}: {round_searched:,}/{searches_per_round:,} searched ({pct:.0f}%)  |  "
                      f"{round_found:,} found this round  |  {tier_found:,} found in tier  |  "
                      f"{rate:.0f} searches/s  |  round elapsed {fmt_duration(round_elapsed)}  |  "
                      f"round ETA {fmt_duration(eta)}  |  tier elapsed {fmt_duration(elapsed)}")
                last_heartbeat  = now_t
                since_heartbeat = 0

        total_searched += round_searched
        elapsed = time.time() - t0
        rate    = total_searched / elapsed if elapsed > 0 else 0
        avg_round_time = elapsed / round_num
        remaining_rounds = rounds - round_num
        print(f"  round {round_num}/{rounds} DONE: {round_found:,} new  |  tier total: {tier_found:,}  |  "
              f"{rate:.0f} searches/s  |  round took {fmt_duration(time.time() - round_start)}  |  "
              f"tier elapsed {fmt_duration(elapsed)}"
              + (f"  |  ~{fmt_duration(avg_round_time * remaining_rounds)} left in this tier" if remaining_rounds else ""))

    print(f"=== {name} DONE: {tier_found:,} pairs in {fmt_duration(time.time() - t0)} ===")
    return tier_found


def generate_pairs(forward, reverse, pages, pageviews, db_path):
    conn = init_db(db_path)
    seen_pairs = load_existing(conn)
    print(f"Resuming: {len(seen_pairs):,} pairs already in DB (deduped across all tiers)")

    grand_total = 0
    for tier in TIERS:
        grand_total += generate_for_tier(tier, forward, reverse, pages, pageviews, conn, seen_pairs)

    print(f"\nDone. {grand_total:,} new pairs added this run.")
    report_tier_counts(conn)
    conn.close()


# Entry point

def main():
    if not os.path.exists(GRAPH_CACHE):
        print(f"ERROR: {GRAPH_CACHE} not found. Run graph_generator.py first.")
        return

    print(f"Loading {GRAPH_CACHE} ...")
    with open(GRAPH_CACHE, "rb") as f:
        data = pickle.load(f)

    pages   = data.get("pages")
    forward = data.get("forward")
    reverse = data.get("reverse")

    if not pages or not forward or not reverse:
        missing = [k for k in ("pages", "forward", "reverse") if not data.get(k)]
        print(f"ERROR: cache missing {missing}. Re-run graph_generator.py.")
        return

    print(f"  pages: {len(pages):,}  forward: {len(forward):,}  reverse: {len(reverse):,}")

    dump = PAGEVIEW_DUMP or find_pageview_dump()
    if not dump or not os.path.exists(dump):
        if os.path.exists(PAGEVIEWS_CACHE):
            dump = "(cached)"
        else:
            print("ERROR: no pageview dump found and no cache present.")
            print("Download from: https://dumps.wikimedia.org/other/pageview_complete/monthly/")
            return

    pageviews = load_pageviews(dump, set(pages.values()))
    generate_pairs(forward, reverse, pages, pageviews, PAIRS_DB)


if __name__ == "__main__":
    main()
