import EventList from "@/components/EventList";

export default function Home() {
  return (
    <div className="flex flex-col gap-4">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">What&apos;s Going On</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Brooklyn &amp; NYC events nearby
        </p>
      </header>
      <EventList />
    </div>
  );
}
