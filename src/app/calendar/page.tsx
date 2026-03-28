import Calendar from "@/components/Calendar";

export default function CalendarPage() {
  return (
    <div className="flex flex-col gap-4">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Browse upcoming events
        </p>
      </header>
      <Calendar />
    </div>
  );
}
