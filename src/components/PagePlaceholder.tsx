interface PagePlaceholderProps {
  description: string;
  title: string;
}

export function PagePlaceholder({ description, title }: PagePlaceholderProps) {
  return (
    <section className="mx-auto my-8 max-w-5xl rounded-xl border border-dashed border-stone-300 bg-white p-6 sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-700">
        Page foundation
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">{description}</p>
    </section>
  );
}
