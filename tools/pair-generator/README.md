# Pair generator

This pipeline builds the article datasets used by WikiRacr. It runs locally because the Wikimedia source dumps and graph caches are too large for the production server and should not be committed to Git.

## Pipeline

1. Download matching `page`, `linktarget`, and `pagelinks` SQL dumps from the same dated English Wikipedia snapshot.
2. Run `check_dump_consistency.py` to catch mismatched dump files.
3. Run `graph_generator.py` to build `wiki_graph.pkl`.
4. Download a monthly Wikimedia pageview dump.
5. Run `pair_generator.py` to build or extend `pairs.db`.
6. Run `higherlower_generator.py` to build `higherlower_articles.json`.
7. Copy the generated datasets into the repository's `data/` directory.

## Required inputs

Place these files in this directory:

```text
enwiki-YYYYMMDD-page.sql.gz
enwiki-YYYYMMDD-linktarget.sql.gz
enwiki-YYYYMMDD-pagelinks.sql.gz
pageviews-YYYY-MM-user.bz2
```

The scripts currently use the `enwiki-latest-*` filenames. Rename a matching dated set or update the constants before running them.

## Commands

```bash
python check_dump_consistency.py
python graph_generator.py
python pair_generator.py
python higherlower_generator.py
```

The graph and pageview caches are intentionally ignored by Git. Pair generation can be interrupted and resumed because results are stored incrementally in SQLite.

## Outputs

```text
wiki_graph.pkl
pageviews_cache.pkl
pairs.db
higherlower_articles.json
```

Only `pairs.db` and `higherlower_articles.json` belong in `data/` for the application runtime.
