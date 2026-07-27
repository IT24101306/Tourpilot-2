import { SocialLineIcon } from "../icons/LineIcons";
import { RichTextHtml } from "../richtext/RichTextHtml";
import { SOCIAL_PLATFORMS, type DisplaySocialLink, type WhoWeAreImage } from "./displayTypes";
import { isRichTextEmpty } from "@tourpilot/shared";

type Props = {
  title: string;
  description: string;
  socialLinks: DisplaySocialLink[];
  images: WhoWeAreImage[];
  fallbackDescription?: string | null;
};

function platformLabel(platform: string, custom?: string) {
  if (custom?.trim()) return custom.trim();
  return SOCIAL_PLATFORMS.find((p) => p.id === platform)?.label ?? platform;
}

export function AgencyWhoWeAreSection({
  title,
  description,
  socialLinks,
  images,
  fallbackDescription,
}: Props) {
  const body = !isRichTextEmpty(description)
    ? description
    : fallbackDescription?.trim() || "";
  const links = socialLinks.filter((l) => l.platform.trim() && l.url.trim());
  const badges = images.filter((img) => img.url.trim());

  return (
    <section
      id="who-we-are"
      className="agency-who-we-are agency-section"
      aria-labelledby="agency-who-we-are-title"
    >
      <div className="agency-display-section-head agency-who-we-are__head">
        <h2 id="agency-who-we-are-title">{title.trim() || "WHO WE ARE"}</h2>
      </div>

      <div className="agency-who-we-are__body">
        {body ? (
          <RichTextHtml html={body} className="agency-who-we-are__description" />
        ) : null}
      </div>

      {badges.length > 0 && (
        <div className="agency-who-we-are__badges" aria-label="Trust badges and reviews">
          {badges.map((img, i) => (
            <figure key={`${img.url}-${i}`} className="agency-who-we-are__badge">
              <img src={img.url} alt={img.alt?.trim() || img.label?.trim() || "Agency badge"} />
              {img.label?.trim() && (
                <figcaption className="agency-who-we-are__badge-label">{img.label}</figcaption>
              )}
            </figure>
          ))}
        </div>
      )}

      {links.length > 0 && (
        <div className="agency-who-we-are__social-row">
          <ul className="agency-who-we-are__social" aria-label="Social links">
            {links.map((link, i) => (
              <li key={`${link.platform}-${i}`}>
                <a
                  href={link.url}
                  className="agency-who-we-are__social-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={platformLabel(link.platform, link.label)}
                  title={platformLabel(link.platform, link.label)}
                >
                  <span className="agency-who-we-are__social-icon" aria-hidden="true">
                    <SocialLineIcon platform={link.platform} size={20} />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
