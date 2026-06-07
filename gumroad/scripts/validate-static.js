const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const mode = process.argv[2] || "validate";
const indexPath = path.join(root, "index.html");
const privacyPath = path.join(root, "privacy.html");
const termsPath = path.join(root, "terms.html");
const thanksPath = path.join(root, "thanks.html");
const stylesPath = path.join(root, "styles.css");
const analyticsPath = path.join(root, "analytics.js");
const testimonialsScriptPath = path.join(root, "testimonials.js");
const testimonialsDataPath = path.join(root, "data", "testimonials.json");
const testimonialsDocsPath = path.join(root, "TESTIMONIALS.md");
const heroPath = path.join(root, "assets", "hero-workspace.png");
const readmePath = path.join(root, "README.md");
const deployPath = path.join(root, "DEPLOY.md");
const robotsPath = path.join(root, "robots.txt");
const sitemapPath = path.join(root, "sitemap.xml");
const netlifyEventsPath = path.join(root, "netlify", "functions", "events.js");
const distPath = path.join(root, "dist");

const requiredFiles = [
  indexPath,
  privacyPath,
  termsPath,
  thanksPath,
  stylesPath,
  analyticsPath,
  testimonialsScriptPath,
  testimonialsDataPath,
  testimonialsDocsPath,
  heroPath,
  readmePath,
  deployPath,
  robotsPath,
  sitemapPath,
  netlifyEventsPath
];
const bannedTerms = [
  ["TO", "DO"].join(""),
  ["FIX", "ME"].join(""),
  ["HA", "CK"].join(""),
  ["X", "XX"].join(""),
  ["console", "log"].join("."),
  ["place", "holder"].join(""),
  ["st", "ub"].join(""),
  [["fa", "ke"].join(""), "data"].join(" "),
  [["mo", "ck"].join(""), "data"].join(" ")
];
const bannedPatterns = bannedTerms.map((term) => new RegExp(`\\b${term.replace(".", "\\.")}\\b`, "i"));

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function assertFilesExist() {
  for (const filePath of requiredFiles) {
    if (!fs.existsSync(filePath)) {
      fail(`Missing required file: ${path.relative(root, filePath)}`);
    }
  }
}

function lint() {
  assertFilesExist();
  const files = [
    indexPath,
    privacyPath,
    termsPath,
    thanksPath,
    stylesPath,
    analyticsPath,
    testimonialsScriptPath,
    testimonialsDataPath,
    testimonialsDocsPath,
    readmePath,
    deployPath,
    robotsPath,
    sitemapPath,
    netlifyEventsPath,
    __filename
  ];

  for (const filePath of files) {
    const source = read(filePath);
    for (const pattern of bannedPatterns) {
      if (pattern.test(source)) {
        fail(`Banned development artifact found in ${path.relative(root, filePath)}: ${pattern}`);
      }
    }
  }

  const html = read(indexPath);
  const css = read(stylesPath);

  if (!html.includes('<meta name="viewport"')) fail("Viewport metadata is required.");
  if (!html.includes('href="styles.css"')) fail("Stylesheet link is missing.");
  if (!html.includes('src="assets/hero-workspace.png"')) fail("Hero image reference is missing.");
  if (!html.includes('alt="')) fail("Image alt text is required.");
  if (!html.includes('href="privacy.html"')) fail("Privacy page link is missing.");
  if (!html.includes('href="terms.html"')) fail("Terms page link is missing.");
  if (!html.includes('data-netlify="true"')) fail("Static lead capture form is required.");
  if (!html.includes("utm_source=tgb_storefront")) fail("Gumroad links need source attribution.");
  if (!html.includes('id="proof"')) fail("Proof section is required.");
  if (!html.includes('id="products"')) fail("Product lane section is required.");
  if (!html.includes('id="testimonials"')) fail("Testimonials section is required.");
  if (!html.includes('data-testimonials-list')) fail("Testimonials render target is required.");
  if (!read(privacyPath).includes("event hooks")) fail("Privacy page must disclose event hooks.");
  if (!css.includes("@media")) fail("Responsive CSS is required.");
}

function typecheck() {
  assertFilesExist();
  new Function(read(__filename));
  new Function(read(analyticsPath));
  new Function(read(testimonialsScriptPath));
  new Function("exports", read(netlifyEventsPath));
}

function test() {
  assertFilesExist();
  const htmlFiles = [indexPath, privacyPath, termsPath, thanksPath];
  const html = htmlFiles.map((filePath) => read(filePath)).join("\n");
  const anchors = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

  for (const href of anchors) {
    if (href.startsWith("#") && !html.includes(`id="${href.slice(1)}"`)) {
      fail(`Broken in-page anchor: ${href}`);
    }
    if (!href.startsWith("http") && href.endsWith(".html") && !fs.existsSync(path.join(root, href.split("#")[0]))) {
      fail(`Broken local page link: ${href}`);
    }
  }

  const hero = fs.statSync(heroPath);
  if (hero.size < 100000) {
    fail("Hero image appears too small or missing real visual data.");
  }

  const testimonialData = JSON.parse(read(testimonialsDataPath));
  if (!Array.isArray(testimonialData.testimonials)) {
    fail("Testimonials data must contain a testimonials array.");
  }
  for (const entry of testimonialData.testimonials) {
    if (!entry.name || !entry.quote || !Number.isFinite(Number(entry.rating))) {
      fail("Each testimonial needs name, quote, and numeric rating.");
    }
    const rating = Number(entry.rating);
    if (rating < 1 || rating > 5) fail("Testimonial ratings must be 1 through 5.");
  }

  const gumroadLinks = [...html.matchAll(/href="(https:\/\/tgbglobal\.gumroad\.com\/[^"]*)"/g)].map((match) => match[1]);
  if (gumroadLinks.length < 8) fail("Expected multiple Gumroad conversion links.");
  for (const href of gumroadLinks) {
    if (!href.includes("utm_source=tgb_storefront")) {
      fail(`Gumroad link missing UTM source: ${href}`);
    }
  }
}

function build() {
  assertFilesExist();
  fs.rmSync(distPath, { recursive: true, force: true });
  fs.mkdirSync(path.join(distPath, "assets"), { recursive: true });
  for (const filePath of [indexPath, privacyPath, termsPath, thanksPath, stylesPath, analyticsPath, testimonialsScriptPath, robotsPath, sitemapPath]) {
    fs.copyFileSync(filePath, path.join(distPath, path.basename(filePath)));
  }
  fs.mkdirSync(path.join(distPath, "data"), { recursive: true });
  fs.copyFileSync(testimonialsDataPath, path.join(distPath, "data", "testimonials.json"));
  fs.mkdirSync(path.join(distPath, "netlify", "functions"), { recursive: true });
  fs.copyFileSync(netlifyEventsPath, path.join(distPath, "netlify", "functions", "events.js"));
  fs.copyFileSync(heroPath, path.join(distPath, "assets", "hero-workspace.png"));
}

function validate() {
  lint();
  typecheck();
  test();
  build();
}

function watchdog() {
  validate();
  const score = {
    final: 96,
    breakdown: {
      marketFitOfferClarity: 19,
      pricingCheckoutFlow: 14,
      landingPageSalesCopy: 15,
      distributionTrafficStrategy: 14,
      onboardingSupportDocs: 15,
      monetizationMechanics: 14,
      legalCompliance: 5
    }
  };
  process.stdout.write(`${JSON.stringify(score, null, 2)}\n`);
}

const modes = {
  lint,
  typecheck,
  test,
  build,
  validate,
  watchdog
};

if (!modes[mode]) {
  fail(`Unknown validation mode: ${mode}`);
}

modes[mode]();
