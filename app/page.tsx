import Link from "next/link";

export default function Page() {
  return (
    <section className="grid gap-8 md:grid-cols-2">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold leading-tight">modern personal banking</h1>
        <p className="text-gray-600">
          manage accounts, transfer money, and stay in control — all with a clean, secure
          experience.
        </p>
        <div className="flex gap-3">
          <Link
            href="/auth/signup"
            className="rounded-md bg-black px-4 py-2 text-white hover:opacity-90"
          >
            get started
          </Link>
          <Link href="/auth/signin" className="rounded-md border px-4 py-2 hover:bg-gray-50">
            sign in
          </Link>
        </div>
      </div>
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="grid gap-3">
          <div className="h-6 w-40 rounded bg-gray-100" />
          <div className="h-24 rounded bg-gray-100" />
          <div className="h-4 w-1/2 rounded bg-gray-100" />
          <div className="h-4 w-3/4 rounded bg-gray-100" />
          <div className="h-4 w-2/3 rounded bg-gray-100" />
        </div>
      </div>
    </section>
  );
}
