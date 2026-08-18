interface PagePlaceholderProps {
  description: string;
  title: string;
}

export function PagePlaceholder({ description, title }: PagePlaceholderProps) {
  return (
    <section className="mx-auto my-12 max-w-7xl rounded-2xl border border-dashed border-stone-300 bg-white p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-700">
        Page foundation
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-stone-600">{description}</p>
    </section>
  );
}
