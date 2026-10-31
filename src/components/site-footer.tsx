import Link from "next/link";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Market",
    links: [
      { label: "Browse ideas", href: "/market" },
      { label: "AI search", href: "/market" },
    ],
  },
  {
    title: "Visioners",
    links: [
      { label: "Ideas Lab", href: "/lab" },
      { label: "Create an idea", href: "/lab/new" },
      { label: "Your account", href: "/account" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/" },
      { label: "Sign up", href: "/account?mode=signup" },
    ],
  },
];

/** The dark rounded shelf every page sits on. */
export default function SiteFooter() {
  return (
    <footer className="panel-dark mt-20 rounded-b-none" style={{ borderRadius: "38px 38px 0 0" }}>
      <div className="max-w-[1200px] mx-auto px-8 pt-16 pb-7 grid gap-10 grid-cols-1 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div>
          <span
            className="font-heading font-bold text-[#fff8f2] block"
            style={{ fontSize: "clamp(32px,4vw,48px)", letterSpacing: "-0.045em", lineHeight: 1.05 }}
          >
            Markedia
          </span>
          <p className="mt-3.5 max-w-[34ch] text-sm leading-[1.65] text-[rgba(255,248,242,0.55)]">
            A market where ideas are documented, scored, priced, and handed to the people who will build them.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title} className="flex flex-col gap-3">
            <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[rgba(255,248,242,0.4)]">
              {col.title}
            </span>
            {col.links.map((l) => (
              <Link
                key={l.label + l.href}
                href={l.href}
                className="text-sm text-[rgba(255,248,242,0.78)] no-underline hover:text-[#fff8f2] transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div className="max-w-[1200px] mx-auto px-8 pt-5 pb-10 border-t border-[rgba(255,248,242,0.12)] flex flex-wrap justify-between gap-5 text-[12.5px] font-semibold text-[rgba(255,248,242,0.42)]">
        <span>markedia.me</span>
        <span>Terms · Privacy</span>
      </div>
    </footer>
  );
}
