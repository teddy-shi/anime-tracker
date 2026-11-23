"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const PAGE_SIZE = 12;
const MAX_RESULTS = 60;

type Anime = {
  id: number;
  title: {
    english: string | null;
    romaji: string | null;
    native: string | null;
  } | null;
  coverImage: { large: string | null } | null;
};

type SearchResponse = {
  data?: {
    Page: {
      media: (Anime | null)[] | null;
      pageInfo: { hasNextPage: boolean | null } | null;
    } | null;
  } | null;
  errors?: { message: string }[];
};

const SEARCH_QUERY = `
  query SearchAnime($search: String!, $page: Int!, $perPage: Int!) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        hasNextPage
      }
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        title {
          english
          romaji
          native
        }
        coverImage {
          large
        }
      }
    }
  }
`;

export default function AnimeSearch() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const query = search.trim();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  return (
    <section className="mx-auto w-full max-w-7xl space-y-3">
      <input
        id="anime-search"
        type="search"
        autoComplete="off"
        aria-label="Search Anime"
        placeholder="Search Anime..."
        value={search}
        aria-describedby="search-status"
        onChange={(event) => setSearch(event.target.value)}
        className="mx-auto block w-full max-w-xl rounded-md border bg-background px-4 py-3
                   outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {query.length < 2 || query !== debouncedSearch ? (
        <p
          id="search-status"
          role="status"
          className="mx-auto w-full max-w-xl text-sm text-muted-foreground"
        >
          {query.length < 2 ? "Enter at least two characters." : "Searching..."}
        </p>
      ) : (
        <SearchResults key={debouncedSearch} query={debouncedSearch} />
      )}
    </section>
  );
}

function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState<Anime[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const sentinel = useRef<HTMLDivElement>(null);
  const requesting = useRef(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPage() {
      try {
        const response = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            query: SEARCH_QUERY,
            variables: { search: query, page, perPage: PAGE_SIZE },
          }),
          signal: controller.signal,
        });

        if (response.status === 429) {
          throw new Error("Too many searches. Please try again shortly.");
        }

        if (!response.ok) {
          throw new Error("Unable to search anime right now.");
        }

        const body: SearchResponse = await response.json();
        const data = body.data?.Page;

        if (body.errors?.length || !data?.media) {
          throw new Error("AniList could not complete the search.");
        }

        if (controller.signal.aborted) return;

        const anime = data.media.filter((item): item is Anime => item !== null);

        setResults((previous) => {
          const unique = new Map(
            [...previous, ...anime].map((item) => [item.id, item]),
          );

          return [...unique.values()].slice(0, MAX_RESULTS);
        });
        setHasMore(
          Boolean(data.pageInfo?.hasNextPage) &&
            anime.length > 0 &&
            page * PAGE_SIZE < MAX_RESULTS,
        );
      } catch (cause) {
        if (controller.signal.aborted) return;

        setError(
          cause instanceof Error ? cause.message : "Something went wrong.",
        );
      } finally {
        if (!controller.signal.aborted) {
          requesting.current = false;
          setLoading(false);
        }
      }
    }

    void loadPage();

    return () => controller.abort();
  }, [query, page]);

  useEffect(() => {
    const element = sentinel.current;

    if (!element || loading || error || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || requesting.current) return;

        requesting.current = true;
        setLoading(true);
        setPage((previous) => previous + 1);
      },
      { rootMargin: "300px" },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [loading, error, hasMore]);

  return (
    <div className="space-y-6">
      <p
        id="search-status"
        role="status"
        className="mx-auto w-full max-w-xl text-sm text-muted-foreground"
      >
        {loading
          ? "Searching..."
          : error || (results.length === 0 ? "No anime found." : "")}
      </p>

      {results.length > 0 && (
        <ul
          aria-label="Anime suggestions"
          aria-busy={loading}
          className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6"
        >
          {results.map((anime) => {
            const title =
              anime.title?.english ??
              anime.title?.romaji ??
              anime.title?.native ??
              "Untitled";
            const cover = anime.coverImage?.large;

            return (
              <li key={anime.id} className="min-w-0 space-y-2">
                <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-muted">
                  {cover && (
                    <Image
                      src={cover}
                      alt=""
                      fill
                      sizes="(min-width: 1280px) 200px, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                      className="object-cover"
                    />
                  )}
                </div>
                <p className="text-sm font-medium leading-snug">{title}</p>
              </li>
            );
          })}
        </ul>
      )}

      <div ref={sentinel} aria-hidden="true" className="h-1" />
    </div>
  );
}
