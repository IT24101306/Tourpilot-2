import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { ModuleHeader } from "../components/module/ModuleHeader";
import {
  DiscoveryAgencyCard,
  type DiscoveryAgency,
} from "../components/discovery/DiscoveryAgencyCard";
import { uniqueDistricts } from "../lib/discoveryUtils";

export function AgenciesPage() {
  const [agencies, setAgencies] = useState<DiscoveryAgency[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [district, setDistrict] = useState("all");

  useEffect(() => {
    setLoading(true);
    api<DiscoveryAgency[]>("/agencies")
      .then(setAgencies)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const districts = useMemo(() => uniqueDistricts(agencies), [agencies]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agencies.filter((a) => {
      if (district !== "all" && a.district !== district) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.tagline?.toLowerCase().includes(q) ?? false) ||
        (a.district?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [agencies, query, district]);

  return (
    <section className="section module-shell module-discovery">
      <ModuleHeader
        module="discovery"
        title="Find your agency"
        subtitle="Compare verified operators, ratings, and tour catalogs — then start planning with confidence."
      >
        <Link to="/register" className="btn btn-teal">
          Sign up free
        </Link>
      </ModuleHeader>

      <div className="disc-toolbar">
        <input
          type="search"
          className="disc-search"
          placeholder="Search by name, region, or specialty…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search agencies"
        />
        <select
          className="disc-filter"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          aria-label="Filter by district"
        >
          <option value="all">All regions</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="muted">Loading agencies…</p>
      ) : filtered.length === 0 ? (
        <div className="disc-empty">
          <p>No agencies match your search.</p>
          <button type="button" className="btn btn-ghost" onClick={() => { setQuery(""); setDistrict("all"); }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="disc-agency-grid">
          {filtered.map((a, i) => (
            <DiscoveryAgencyCard key={a.id} agency={a} featured={i === 0 && !query && district === "all"} />
          ))}
        </div>
      )}
    </section>
  );
}
