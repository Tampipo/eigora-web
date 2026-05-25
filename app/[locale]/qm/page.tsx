import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const MODULES = ["harmonic", "barrier", "well"] as const;

export default async function QmIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("qm");

  return (
    <section className="space-y-10">
      <header className="space-y-3">
        <h1 className="font-serif text-4xl tracking-tight">
          {t("index.heading")}
        </h1>
        <p className="max-w-prose text-muted">{t("index.intro")}</p>
      </header>

      <ul className="divide-y divide-border border-y border-border">
        {MODULES.map((slug) => (
          <li key={slug}>
            <Link
              href={`/qm/${slug}`}
              className="group flex items-baseline justify-between gap-6 py-5 transition-colors"
            >
              <span className="space-y-1">
                <span className="block font-serif text-xl text-foreground group-hover:text-accent">
                  {t(`modules.${slug}.title`)}
                </span>
                <span className="block text-sm text-muted">
                  {t(`modules.${slug}.summary`)}
                </span>
              </span>
              <span
                aria-hidden
                className="shrink-0 text-muted transition-colors group-hover:text-accent"
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
