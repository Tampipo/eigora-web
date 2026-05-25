import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { SidebarNavItem } from "./SidebarNavItem";

const QM_MODULES = ["harmonic", "barrier", "well"] as const;

export async function Sidebar() {
  const t = await getTranslations("nav");
  const site = await getTranslations("site");
  const qm = await getTranslations("qm.modules");

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-border bg-surface/30 px-5 py-6">
      <Link
        href="/"
        className="block text-foreground"
      >
        <span className="block font-semibold tracking-tight text-lg leading-none">
          {site("title")}
        </span>
        <span className="mt-1.5 block text-xs text-muted">
          {site("tagline")}
        </span>
      </Link>

      <nav className="mt-10 flex-1 space-y-7 text-sm">
        <div className="space-y-0.5">
          <SidebarNavItem href="/" label={t("home")} />
        </div>

        <div className="space-y-1">
          <p className="px-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
            {t("qm")}
          </p>
          <div className="space-y-0.5">
            <SidebarNavItem href="/qm" label="Overview" />
            {QM_MODULES.map((slug) => (
              <SidebarNavItem
                key={slug}
                href={`/qm/${slug}`}
                label={qm(`${slug}.title`)}
                indent
              />
            ))}
          </div>
        </div>
      </nav>

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
          Locale
        </span>
        <LocaleSwitcher />
      </div>
    </aside>
  );
}
