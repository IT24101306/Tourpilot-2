/**
 * Hydrates #pricing on marketing-home.html from GET /api/cms/pricing.
 * Falls back to embedded defaults if the API is unavailable.
 */
(function () {
  var DEFAULT_FILTER = "Website + Full System";

  var DEFAULT = {
    type: "pricing",
    headline: "Choose the way you grow online",
    packageTypeLabel: "Package",
    packageTypeAccent: "type",
    filterOptions: [
      { value: "All", label: "All" },
      { value: "Website", label: "Website" },
      { value: "Website + Full System", label: "Website + Full System" },
    ],
    packages: [],
    buildYourselfFeatures: [],
    includedFeaturesTitle: "All Features Included",
    includedFeaturesSections: [],
    moreFeaturesTitle: "More features",
    moreFeaturesSubtitle: "Select extras for your Build Yourself plan",
    monthlyTotalLabel: "Monthly total",
    termsTitle: "Terms & Conditions",
    termsBody:
      "SriLankaTourPilot has the right to change the packages when needed, with 6 months' notice.",
  };

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Normalize legacy string lines or `{ text, bold, underline }` objects. */
  function normalizeLine(line) {
    if (typeof line === "string") {
      var t = line.trim();
      return t ? { text: t, bold: false, underline: false } : null;
    }
    if (line && typeof line === "object" && typeof line.text === "string") {
      var text = line.text.trim();
      if (!text) return null;
      return {
        text: text,
        bold: Boolean(line.bold),
        underline: Boolean(line.underline),
      };
    }
    return null;
  }

  function normalizeLines(lines) {
    if (!Array.isArray(lines)) return [];
    return lines.map(normalizeLine).filter(Boolean);
  }

  function renderFeatureLi(line) {
    var cls = [];
    if (line.bold) cls.push("is-bold");
    if (line.underline) cls.push("is-underline");
    return (
      "<li" +
      (cls.length ? ' class="' + cls.join(" ") + '"' : "") +
      ">" +
      escapeHtml(line.text) +
      "</li>"
    );
  }

  function renderFeatureList(lines, extraClass) {
    var items = normalizeLines(lines);
    if (!items.length) return "";
    return (
      '<ul class="pkg-features' +
      (extraClass ? " " + extraClass : "") +
      '">' +
      items.map(renderFeatureLi).join("") +
      "</ul>"
    );
  }

  function formatLkr(amount) {
    return "LKR " + Math.round(Number(amount) || 0).toLocaleString("en-LK");
  }

  function parseContent(blocks) {
    var list = Array.isArray(blocks) ? blocks : [];
    var block = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].type === "pricing") {
        block = list[i];
        break;
      }
    }
    if (!block) return null;
    return Object.assign({}, DEFAULT, block, {
      type: "pricing",
      filterOptions:
        block.filterOptions && block.filterOptions.length
          ? block.filterOptions
          : DEFAULT.filterOptions,
      packages: block.packages && block.packages.length ? block.packages : DEFAULT.packages,
      buildYourselfFeatures:
        block.buildYourselfFeatures && block.buildYourselfFeatures.length
          ? block.buildYourselfFeatures
          : DEFAULT.buildYourselfFeatures,
      includedFeaturesSections:
        block.includedFeaturesSections && block.includedFeaturesSections.length
          ? block.includedFeaturesSections
          : DEFAULT.includedFeaturesSections,
    });
  }

  function ctaHref(href) {
    var h = (href || "#contact").trim() || "#contact";
    // Keep hash anchors on the marketing page; send signup CTAs into the app.
    if (h === "/pricing") {
      return { href: "#pricing", target: "" };
    }
    if (h.indexOf("/register-pro") === 0 || h.indexOf("/register/pro") === 0) {
      return { href: h, target: "_top" };
    }
    if (h === "/register") {
      return { href: "/register", target: "_top" };
    }
    if (h.charAt(0) === "#") return { href: h, target: "" };
    if (h.indexOf("http") === 0) return { href: h, target: "_blank" };
    return { href: h, target: "_top" };
  }

  function packageRegisterHref(pkg, buildTotal) {
    var params = new URLSearchParams();
    params.set("package", pkg.id || "package");
    params.set("name", pkg.name || "Package");
    var billing = pkg.billing || (pkg.buildYourself ? "CUSTOM" : "MONTHLY");
    params.set("billing", billing);
    var priceLkr =
      pkg.buildYourself && buildTotal != null
        ? Math.round(Number(buildTotal) || 0)
        : Math.round(Number(pkg.priceLkr) || Number(pkg.loginFeeLkr) || 0);
    params.set("priceLkr", String(priceLkr));
    var label =
      pkg.buildYourself && buildTotal != null
        ? "LKR " + Math.round(Number(buildTotal) || 0).toLocaleString("en-LK") + " / month"
        : pkg.priceLabel || pkg.price || "LKR " + priceLkr.toLocaleString("en-LK");
    params.set("priceLabel", label);
    return "/register-pro?" + params.toString();
  }

  function featureCheckbox(f) {
    return (
      "<li><label>" +
      '<input type="checkbox" data-feature="' +
      escapeHtml(f.id) +
      '" data-price="' +
      Number(f.priceLkr || 0) +
      '"' +
      (f.defaultChecked ? " checked" : "") +
      ' onchange="syncFeature(this)" />' +
      '<span class="feat-name">' +
      escapeHtml(f.name) +
      "</span>" +
      '<span class="feat-price">' +
      escapeHtml(formatLkr(f.priceLkr)) +
      "</span>" +
      "</label></li>"
    );
  }

  function renderPackage(pkg, index, content) {
    var cats = (pkg.categories || []).join(",");
    var delay = index * 80;
    var border = pkg.featured
      ? "border-2 border-lime bg-surface-card shadow-lift"
      : "bg-surface shadow-card";
    var registerHref = packageRegisterHref(pkg);
    var cta = ctaHref(registerHref);
    var featuresHtml = renderFeatureList(pkg.features);
    var extraFeaturesHtml = "";
    var extraLines = normalizeLines(pkg.featuresExtra);
    if (extraLines.length) {
      var extraTitle = (pkg.featuresExtraTitle || "").trim();
      extraFeaturesHtml =
        (extraTitle
          ? '<p class="pkg-features-extra-title">' + escapeHtml(extraTitle) + "</p>"
          : "") + renderFeatureList(pkg.featuresExtra, "pkg-features--extra");
    }

    var extra = "";
    if (pkg.buildYourself) {
      var primary = (content.buildYourselfFeatures || []).filter(function (f) {
        return f.primary;
      });
      extra +=
        '<ul class="feature-picker" id="buildYourselfFeatures">' +
        primary.map(featureCheckbox).join("") +
        "</ul>";
      extra +=
        '<button type="button" class="mb-3 inline-flex items-center justify-center self-center rounded-full border border-ink-900/10 bg-white px-3.5 py-2 text-xs font-semibold text-lime-dark transition hover:border-lime hover:bg-lime/10" onclick="openMoreFeaturesModal()">View more features</button>';
      extra +=
        '<div class="flex items-center justify-between gap-2 rounded-lg border border-lime/25 bg-lime/10 px-2.5 py-1.5">' +
        '<span class="text-[0.65rem] font-semibold text-lime-dark">' +
        escapeHtml(content.monthlyTotalLabel || "Monthly total") +
        "</span>" +
        '<span class="text-sm font-bold text-lime-dark" id="buildYourselfTotal">LKR 0</span>' +
        "</div>";
    }
    if (pkg.showIncludedFeatures) {
      extra +=
        '<button type="button" class="mt-auto inline-flex items-center justify-center self-center rounded-full border border-ink-900/10 bg-white px-3.5 py-2 text-xs font-semibold text-lime-dark transition hover:border-lime hover:bg-lime/10" onclick="openFeaturesModal(\'' +
        escapeHtml(pkg.name).replace(/'/g, "\\'") +
        "')\">" +
        escapeHtml(pkg.includedFeaturesLabel || "View included features") +
        "</button>";
    }

    return (
      '<article class="pkg-card service-card reveal-scale rounded-card p-4 sm:p-5 ' +
      border +
      '" data-category="' +
      escapeHtml(cats) +
      '" style="--reveal-delay: ' +
      delay +
      'ms">' +
      '<h3 class="text-lg font-bold text-ink-900">' +
      escapeHtml(pkg.name) +
      "</h3>" +
      '<p class="pkg-tagline">' +
      escapeHtml(pkg.tagline) +
      "</p>" +
      '<div class="pkg-price">' +
      '<p class="text-xl font-bold text-lime-dark">' +
      escapeHtml(pkg.price) +
      "</p>" +
      '<p class="mt-1 text-[0.65rem] font-bold uppercase tracking-wide text-ink-400">' +
      escapeHtml(pkg.priceSub) +
      "</p>" +
      "</div>" +
      '<a href="' +
      escapeHtml(cta.href) +
      '"' +
      (cta.target ? ' target="' + cta.target + '"' : "") +
      (cta.target === "_blank" ? ' rel="noopener noreferrer"' : "") +
      ' class="btn-primary pkg-cta inline-flex w-full items-center justify-center rounded-full bg-lime px-4 py-2.5 text-sm font-semibold text-white">' +
      escapeHtml(pkg.ctaLabel || "Get Started") +
      "</a>" +
      featuresHtml +
      extraFeaturesHtml +
      extra +
      "</article>"
    );
  }

  function renderPricing(content) {
    var root = document.getElementById("pricing-cms-root");
    if (!root) return;

    var options = content.filterOptions || [];
    var defaultOpt = null;
    for (var i = 0; i < options.length; i++) {
      if (options[i] && options[i].value === DEFAULT_FILTER) {
        defaultOpt = options[i];
        break;
      }
    }
    if (!defaultOpt && options.length) defaultOpt = options[0];
    var defaultValue = (defaultOpt && defaultOpt.value) || DEFAULT_FILTER;
    var defaultLabel = (defaultOpt && defaultOpt.label) || defaultValue;

    var filterOpts = options
      .map(function (o) {
        return (
          '<li role="option"' +
          (o.value === defaultValue ? ' class="selected"' : "") +
          ' data-value="' +
          escapeHtml(o.value) +
          '" onclick="selectOption(this)">' +
          escapeHtml(o.label) +
          "</li>"
        );
      })
      .join("");

    var cards = (content.packages || [])
      .map(function (pkg, i) {
        return renderPackage(pkg, i, content);
      })
      .join("");

    var terms =
      content.termsTitle || content.termsBody
        ? '<div class="reveal mx-auto mt-12 max-w-2xl text-center sm:mt-16">' +
          (content.termsTitle
            ? '<h3 class="text-base font-bold text-ink-900">' +
              escapeHtml(content.termsTitle) +
              "</h3>"
            : "") +
          (content.termsBody
            ? '<p class="mt-2 text-sm text-ink-500">' + escapeHtml(content.termsBody) + "</p>"
            : "") +
          "</div>"
        : "";

    root.innerHTML =
      '<div class="reveal mx-auto max-w-2xl text-center">' +
      '<h2 class="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl md:text-4xl">' +
      escapeHtml(content.headline) +
      "</h2>" +
      "</div>" +
      '<div class="reveal mt-8 text-center sm:mt-10">' +
      '<label class="mb-2 block text-sm font-semibold text-ink-900">' +
      escapeHtml(content.packageTypeLabel || "Package") +
      ' <span class="text-lime">' +
      escapeHtml(content.packageTypeAccent || "type") +
      "</span></label>" +
      '<div class="pkg-select-wrap" id="packageSelect">' +
      '<button type="button" class="pkg-select flex w-full items-center justify-between gap-3 rounded-card border border-ink-900/10 bg-white px-4 py-3.5 text-left text-[0.9375rem] text-ink-900 shadow-card transition hover:border-lime" aria-haspopup="listbox" aria-expanded="false" onclick="toggleSelect(this)">' +
      '<span class="custom-select-value">' +
      escapeHtml(defaultLabel) +
      "</span>" +
      '<svg class="pkg-chevron h-[18px] w-[18px] shrink-0 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
      "</button>" +
      '<ul class="pkg-options" role="listbox">' +
      filterOpts +
      "</ul>" +
      "</div></div>" +
      '<div class="pkg-grid mt-8 sm:mt-12">' +
      cards +
      "</div>" +
      terms;

    // Included features modal body
    var featuresBody = document.querySelector("#featuresModal .modal-body");
    var featuresTitle = document.getElementById("featuresModalTitle");
    if (featuresTitle) featuresTitle.textContent = content.includedFeaturesTitle || "All Features Included";
    if (featuresBody) {
      featuresBody.innerHTML = (content.includedFeaturesSections || [])
        .map(function (sec) {
          return (
            '<details class="feature-row"><summary><span>' +
            escapeHtml(sec.title) +
            '</span><span>✓</span></summary><ul class="detail-list">' +
            normalizeLines(sec.details)
              .map(function (d) {
                var cls = [];
                if (d.bold) cls.push("is-bold");
                if (d.underline) cls.push("is-underline");
                return (
                  "<li" +
                  (cls.length ? ' class="' + cls.join(" ") + '"' : "") +
                  ">" +
                  escapeHtml(d.text) +
                  "</li>"
                );
              })
              .join("") +
            "</ul></details>"
          );
        })
        .join("");
    }

    // More features modal
    var moreTitle = document.getElementById("moreFeaturesTitle");
    var moreSub = document.querySelector("#moreFeaturesModal .mt-0\\.5, #moreFeaturesModal [data-more-sub]");
    var moreSubEl = document.getElementById("moreFeaturesSubtitle");
    if (moreTitle) moreTitle.textContent = content.moreFeaturesTitle || "More features";
    if (moreSubEl) moreSubEl.textContent = content.moreFeaturesSubtitle || "";
    else if (moreSub) moreSub.textContent = content.moreFeaturesSubtitle || "";

    var moreList = document.getElementById("buildYourselfMoreFeatures");
    if (moreList) {
      moreList.innerHTML = (content.buildYourselfFeatures || []).map(featureCheckbox).join("");
    }

    var modalTotalLabel = document.getElementById("buildYourselfModalTotalLabel");
    if (modalTotalLabel) modalTotalLabel.textContent = content.monthlyTotalLabel || "Monthly total";

    if (typeof updateBuildTotal === "function") updateBuildTotal();
    if (typeof filterPackages === "function") filterPackages(defaultValue);

    // Re-observe reveals for newly injected nodes
    if (window.__tpObserveReveals) window.__tpObserveReveals();

    if (window.location.hash === "#pricing") {
      var section = document.getElementById("pricing");
      if (section) {
        requestAnimationFrame(function () {
          section.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    }
  }

  function hydrate() {
    fetch("/api/cms/pricing")
      .then(function (r) {
        if (!r.ok) throw new Error("cms");
        return r.json();
      })
      .then(function (page) {
        var content = parseContent(page.blocks);
        if (content && content.packages && content.packages.length) {
          renderPricing(content);
        }
      })
      .catch(function () {
        /* keep static HTML fallback */
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hydrate);
  } else {
    hydrate();
  }
})();
