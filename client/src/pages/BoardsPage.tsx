/**
 * Placeholder boards listing. Real board CRUD + data fetching arrives in
 * Phase 2 once auth and the boards API exist.
 */
export function BoardsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Your boards</h1>
      <p className="mt-2 text-sm text-slate-600">
        Boards will appear here once the boards API and authentication land.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-400"
          >
            Board placeholder
          </div>
        ))}
      </div>
    </div>
  );
}
