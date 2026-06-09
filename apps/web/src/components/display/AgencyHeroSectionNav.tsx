type SectionLink = {
  id: string;
  label: string;
};

type Props = {
  links: SectionLink[];
};

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function AgencyHeroSectionNav({ links }: Props) {
  if (links.length === 0) return null;

  return (
    <nav className="agency-hero-section-nav" aria-label="Page sections">
      <ul className="agency-hero-section-nav__list">
        {links.map((link) => (
          <li key={link.id}>
            <button type="button" onClick={() => scrollToSection(link.id)}>
              {link.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
