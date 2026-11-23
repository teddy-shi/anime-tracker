import AnimeSearch from "@/components/anime-search";

export default function Home() {
  return (
    <main className="px-6 py-16">
      <h1 className="mb-8 text-center text-3xl font-semibold">
        Anime Tracker
      </h1>
      <AnimeSearch />
    </main>
  );
}