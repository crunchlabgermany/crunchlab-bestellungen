import db from "../../db.server.js";

const SOURCES = {
  marketing: [
    ["Shopify Marketing Guides", "Shopify", "https://www.shopify.com/blog/marketing", "OFFICIAL_BLOG", 90],
    ["Shopify Marketing Development", "Shopify", "https://shopify.dev/docs/apps/build/marketing", "OFFICIAL_DOCS", 95],
  ],
  seo: [
    ["Google Search Central", "Google", "https://developers.google.com/search/docs", "OFFICIAL_DOCS", 100],
    ["Google SEO Starter Guide", "Google", "https://developers.google.com/search/docs/fundamentals/seo-starter-guide", "OFFICIAL_DOCS", 100],
    ["Shopify Theme SEO", "Shopify", "https://shopify.dev/docs/storefronts/themes/seo", "OFFICIAL_DOCS", 95],
  ],
  "social-media": [
    ["Meta Business Help Center", "Meta", "https://www.facebook.com/business/help", "OFFICIAL_DOCS", 95],
    ["TikTok Creative Center", "TikTok", "https://ads.tiktok.com/business/creativecenter", "OFFICIAL_DOCS", 95],
    ["YouTube Creators", "YouTube", "https://www.youtube.com/creators/", "OFFICIAL_DOCS", 95],
  ],
  "email-marketing": [
    ["Shopify Email Marketing", "Shopify", "https://www.shopify.com/blog/email-marketing", "OFFICIAL_BLOG", 90],
    ["Google Email Sender Guidelines", "Google", "https://support.google.com/a/answer/81126", "OFFICIAL_DOCS", 100],
    ["CAN-SPAM Compliance Guide", "Federal Trade Commission", "https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business", "GOVERNMENT", 100],
  ],
};

export async function ensureKnowledgeSources(shop, agents) {
  for (const agent of agents) for (const [title, publisher, url, sourceType, authorityScore] of SOURCES[agent.slug] || []) {
    await db.knowledgeSource.upsert({ where: { shop_agentId_url: { shop, agentId: agent.id, url } }, create: { shop, agentId: agent.id, title, publisher, url, sourceType, authorityScore, freeAccess: true }, update: { title, publisher, sourceType, authorityScore, freeAccess: true } });
  }
}

export function curatedSourceCount() { return Object.values(SOURCES).reduce((sum, sources) => sum + sources.length, 0); }
