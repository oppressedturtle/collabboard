import { Link } from 'react-router-dom';

const features = [
  {
    title: 'Realtime collaboration',
    body: 'See teammates move cards live. Changes sync instantly over WebSockets.',
  },
  {
    title: 'Boards your way',
    body: 'Lists, drag-and-drop cards, labels, assignees, and due dates.',
  },
  {
    title: 'Role-based access',
    body: 'Owners, editors, and viewers — invite your team with the right permissions.',
  },
];

export function HomePage() {
  return (
    <div className="space-y-12">
      <section className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Plan together, <span className="text-brand-600">in real time</span>.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          CollabBoard is a realtime collaborative Kanban board for teams. Organize
          work into boards and lists, drag cards across columns, and watch everyone
          stay in sync — instantly.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            to="/login"
            className="rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            Get started
          </Link>
          <Link
            to="/boards"
            className="rounded-md px-5 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300 transition-colors hover:bg-slate-100"
          >
            View boards
          </Link>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-base font-semibold text-slate-900">{feature.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{feature.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
