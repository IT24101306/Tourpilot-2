/** IYYO Solutions — project catalogue */
const createProjectPlaceholder = (title, subtitle, startColor, endColor) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" role="img" aria-label="${title}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${startColor}" />
          <stop offset="100%" stop-color="${endColor}" />
        </linearGradient>
      </defs>
      <rect width="1200" height="900" fill="url(#bg)" />
      <rect x="72" y="72" width="1056" height="756" rx="40" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.16)" />
      <text x="112" y="220" fill="#ffffff" font-family="Outfit, Arial, sans-serif" font-size="58" font-weight="700">${title}</text>
      <text x="112" y="292" fill="rgba(255,255,255,0.84)" font-family="Outfit, Arial, sans-serif" font-size="30" font-weight="400">${subtitle}</text>
      <path d="M112 360H788" stroke="rgba(255,255,255,0.26)" stroke-width="4" stroke-linecap="round" />
      <text x="112" y="432" fill="rgba(255,255,255,0.68)" font-family="Outfit, Arial, sans-serif" font-size="24" letter-spacing="3">IYYO SOLUTIONS</text>
    </svg>
  `)}`;

const IYYO_PROJECTS = [
  {
    id: "medwaste",
    title: "medwaste.lk — Website",
    category: "B2B Healthcare Solutions (Pvt) Ltd",
    image: "assets/projects/medwaste.png",
    summary:
      "Public-facing digital platform for Sri Lanka's premier pharmaceutical waste disposal specialist.",
    descriptionHtml: `
      <p>We designed and developed the public-facing digital platform for MedWaste — Sri Lanka's premier pharmaceutical waste disposal specialist, approved and monitored by the National Medicines Regulatory Authority (NMRA).</p>
      <p>The website was built to reflect the credibility and compliance standards the brand operates under — clean, professional, and aligned with the trust that healthcare clients and regulators expect.</p>
      <p class="project-panel-website">Website: <a href="https://medwaste.lk" target="_blank" rel="noreferrer">medwaste.lk</a></p>
    `,
    services: ["Web Design & Development", "UI/UX Design", "Regulatory Technology"],
    deliverables: ["Public-facing website", "Brand-aligned interface", "Compliance-ready presentation"],
    status: "Live",
    website: "https://medwaste.lk",
    year: "2025",
  },
  {
    id: "medwaste-management-system",
    title: "MedWaste — Internal Management System",
    category: "B2B Healthcare Solutions (Pvt) Ltd",
    image: "assets/projects/medwaste-system.png",
    summary:
      "Internal system for the complete lifecycle of pharmaceutical and medical waste operations.",
    descriptionHtml: `
      <p>Beyond the website, we designed and built a fully integrated management system that handles the complete lifecycle of pharmaceutical and medical waste — from collection request to final processing — across pharmacies, hospitals, and healthcare centres nationwide.</p>
      <p>This wasn't a standard software project. It was a complete digital transformation of a compliance-critical operation, turning a process that relied on manual coordination into a streamlined, technology-driven system monitored against NMRA standards.</p>
      <div class="project-panel-block">
        <h3>What we delivered</h3>
        <ul class="project-panel-list">
          <li>End-to-end waste lifecycle management</li>
          <li>Seamless tracking across multiple collection points</li>
          <li>Multi-location operations under a single system</li>
          <li>Technology aligned with NMRA compliance standards</li>
        </ul>
      </div>
      <p>At IYYO Solutions, we don't just build products. We solve real problems.</p>
    `,
    services: [
      "Custom Software Development",
      "System Architecture",
      "Workflow Automation",
      "Regulatory Technology",
    ],
    deliverables: ["Lifecycle tracking", "Multi-point coordination", "Compliance operations"],
    status: "Live",
    year: "2025",
  },
  {
    id: "dm-island-spice",
    title: "DM Island Spice — E-commerce Platform",
    category: "Ceylon Products Importers & Distributors (Pvt) Ltd",
    image: "assets/projects/dm-island-spice.png",
    summary:
      "A sophisticated, modern e-commerce platform bringing authentic Ceylon flavours to customers throughout California.",
    descriptionHtml: `
      <p>A sophisticated, modern e-commerce platform bringing authentic Ceylon flavours to customers throughout California through an intuitive and seamless digital experience.</p>
      <p>This project was delivered in two phases. Phase 01 established a clean, responsive static website to showcase the brand's authenticity and commitment to quality. Phase 02 — now live — delivered a fully functional, feature-rich online store built to elevate the brand's digital presence and enhance the shopping experience.</p>
      <div class="project-panel-block">
        <h3>What we delivered</h3>
        <ul class="project-panel-list">
          <li>Fully integrated online store</li>
          <li>Optimised product browsing and purchasing flow</li>
          <li>Secure checkout and payment gateway integration</li>
          <li>Mobile-first, responsive user experience</li>
        </ul>
      </div>
      <p>Customers can now seamlessly explore and purchase a wide range of authentic Ceylon spices directly through the website.</p>
      <p class="project-panel-quote">Client recognition: “Thank you IYYO Solutions for the amazing work done for the website.” — Dewni Tissera, Certified Equity Securities Advisor, John Keells Stock Brokers (via LinkedIn)</p>
      <p class="project-panel-website">Website: <a href="https://dmislandspice.com" target="_blank" rel="noreferrer">dmislandspice.com</a></p>
    `,
    services: [
      "Web Design & Development",
      "E-commerce Development",
      "Payment Integration",
      "UI/UX Design",
    ],
    deliverables: ["Online store", "Checkout flow", "Mobile-first storefront"],
    status: "Live",
    website: "https://dmislandspice.com",
    year: "2025",
  },
  {
    id: "lanka-auto-parts",
    title: "Lanka Auto Parts",
    category: "lankaautoparts.lk",
    image: "assets/projects/lanka-auto-parts.png",
    summary:
      "A modern, user-friendly platform for the premier spare parts and vehicle repair centre.",
    descriptionHtml: `
      <p>We designed and developed a modern, user-friendly platform for Lanka Auto Parts — the premier spare parts and vehicle repair centre — helping them establish a strong digital footprint and connect more effectively with their customers.</p>
      <p>By combining performance with a clean user interface, we laid a solid digital foundation for the brand. Phase 02 is in progress, where we will be integrating an advanced inquiry system directly into the platform.</p>
      <p>At IYYO Solutions, we don't just build websites. We build complete digital experiences.</p>
      <p class="project-panel-website">Website: <a href="https://lankaautoparts.lk" target="_blank" rel="noreferrer">lankaautoparts.lk</a></p>
    `,
    services: [
      "Web Design & Development",
      "Digital Marketplace",
      "Social Media Management",
      "Performance Advertising",
    ],
    deliverables: ["Responsive website", "Brand platform", "Inquiry system roadmap"],
    status: "Live",
    website: "https://lankaautoparts.lk",
    year: "2024",
  },
  {
    id: "colour-lab",
    title: "Colour Lab — POS System",
    category: "Photo-Home Colour Lab, a Kodak Studio",
    image: "assets/projects/colour-lab-pos.png",
    summary:
      "A fully customised Point of Sale system tailored to studio operations and customer flow.",
    descriptionHtml: `
      <p>A fully customised Point of Sale system, designed and implemented precisely to the studio's workflow and operational requirements. The system is now operating seamlessly, enhancing both staff productivity and the overall customer experience.</p>
    `,
    services: [
      "POS System Development",
      "Custom Software",
      "Workflow Automation",
    ],
    deliverables: ["POS workflow", "Custom studio operations", "Live deployment"],
    status: "Live",
    year: "2025",
  },
  {
    id: "yasho-ballet-school",
    title: "Yasho Ballet School",
    category: "Website Design & Development",
    image: "assets/projects/yasho-ballet-school.png",
    summary:
      "Ballet school website showcasing classes, faculty, and the student community.",
    description:
      "IYYO created a welcoming digital presence for Yasho Ballet School — reflecting the grace and discipline of classical ballet while making class information and enrolment easy for parents and students.",
    services: ["UI/UX Design", "Front-end Development", "Brand Photography"],
    deliverables: ["Responsive website", "Class information", "Contact pages"],
    year: "2025",
  },
  {
    id: "salesrep",
    title: "SalesRep",
    category: "Pharmaceutical marketplace",
    image: "assets/projects/salesrep.png",
    summary:
      "A pharmaceutical marketplace rethinking how procurement and sales move through the industry.",
    descriptionHtml: `
      <p>A pharmaceutical marketplace rethinking how procurement and sales move through the industry. Built for a sector that's needed this for a while.</p>
    `,
    services: [
      "Custom Software Development",
      "Marketplace Platform",
      "SaaS",
    ],
    deliverables: ["Product strategy", "Platform architecture", "Marketplace roadmap"],
    status: "In Development",
    year: "2026",
    comingSoon: true,
  },
  {
    id: "harvester",
    title: "Harvester",
    category: "Commercial scraping SaaS",
    image: "assets/projects/harvester.png",
    summary:
      "A commercial web scraping SaaS with a spider marketplace, subscription layer, and public API.",
    descriptionHtml: `
      <p>A commercial web scraping SaaS with a spider marketplace, subscription layer, and public API. For businesses that need data at scale without engineering the infrastructure themselves.</p>
    `,
    services: ["SaaS Development", "API Development", "System Architecture"],
    deliverables: ["Platform concept", "API foundation", "Subscription model"],
    status: "In Development",
    year: "2026",
    comingSoon: true,
  },
];
