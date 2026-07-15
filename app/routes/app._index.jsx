import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return null;
};

const kennzahlen = [
  {
    titel: "Neue Bestellungen",
    wert: "0",
    beschreibung: "Warten auf Bearbeitung",
    symbol: "📦",
  },
  {
    titel: "In Produktion",
    wert: "0",
    beschreibung: "Müslis werden zusammengestellt",
    symbol: "🥣",
  },
  {
    titel: "Versandbereit",
    wert: "0",
    beschreibung: "Fertig verpackte Bestellungen",
    symbol: "🚚",
  },
  {
    titel: "Bestellungen heute",
    wert: "0",
    beschreibung: "Eingegangene Bestellungen",
    symbol: "🛒",
  },
  {
    titel: "Umsatz heute",
    wert: "0,00 €",
    beschreibung: "Automatisch aus Shopify",
    symbol: "💶",
  },
  {
    titel: "Gewinn heute",
    wert: "0,00 €",
    beschreibung: "Nach Abzug des Wareneinsatzes",
    symbol: "📈",
  },
];

const letzteBestellungen = [];

export default function Index() {
  return (
    <s-page heading="CrunchLab Dashboard">
      <s-button slot="primary-action" href="/app/bestellungen">
        Bestellungen öffnen
      </s-button>

      <s-section>
        <s-stack direction="block" gap="base">
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "24px",
                lineHeight: 1.3,
              }}
            >
              Willkommen bei CrunchLab
            </h2>

            <p
              style={{
                marginTop: "8px",
                marginBottom: 0,
                color: "#616161",
              }}
            >
              Hier siehst du später alle wichtigen Zahlen zu Bestellungen,
              Produktion und Gewinn auf einen Blick.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            {kennzahlen.map((kennzahl) => (
              <div
                key={kennzahl.titel}
                style={{
                  padding: "20px",
                  border: "1px solid #dedede",
                  borderRadius: "14px",
                  background: "#ffffff",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "30px",
                    }}
                    aria-hidden="true"
                  >
                    {kennzahl.symbol}
                  </span>

                  <span
                    style={{
                      padding: "4px 9px",
                      borderRadius: "999px",
                      background: "#f1f1f1",
                      color: "#616161",
                      fontSize: "12px",
                    }}
                  >
                    Live
                  </span>
                </div>

                <p
                  style={{
                    marginTop: "18px",
                    marginBottom: "5px",
                    color: "#616161",
                    fontSize: "14px",
                  }}
                >
                  {kennzahl.titel}
                </p>

                <p
                  style={{
                    margin: 0,
                    fontSize: "28px",
                    fontWeight: 700,
                  }}
                >
                  {kennzahl.wert}
                </p>

                <p
                  style={{
                    marginTop: "7px",
                    marginBottom: 0,
                    color: "#787878",
                    fontSize: "13px",
                  }}
                >
                  {kennzahl.beschreibung}
                </p>
              </div>
            ))}
          </div>
        </s-stack>
      </s-section>

      <s-section heading="Schnellzugriff">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "12px",
          }}
        >
          <s-button href="/app/bestellungen">
            📦 Bestellungen
          </s-button>

          <s-button disabled>
            🥣 Produktion
          </s-button>

          <s-button disabled>
            🌾 Zutaten
          </s-button>

          <s-button disabled>
            📋 Rezepte
          </s-button>

          <s-button disabled>
            📊 Statistiken
          </s-button>

          <s-button disabled>
            ⚙️ Einstellungen
          </s-button>
        </div>
      </s-section>

      <s-section heading="Letzte Bestellungen">
        {letzteBestellungen.length === 0 ? (
          <s-box
            padding="large"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-stack direction="block" gap="small">
              <s-heading>Noch keine Bestellungen vorhanden</s-heading>

              <s-paragraph>
                Sobald Shopify-Bestellungen mit der App verbunden sind,
                erscheinen hier automatisch die neuesten Bestellungen.
              </s-paragraph>

              <s-button href="/app/bestellungen">
                Zur Bestellübersicht
              </s-button>
            </s-stack>
          </s-box>
        ) : (
          <div>
            {letzteBestellungen.map((bestellung) => (
              <div key={bestellung.id}>{bestellung.name}</div>
            ))}
          </div>
        )}
      </s-section>

      <s-section slot="aside" heading="Produktionsübersicht">
        <s-stack direction="block" gap="base">
          <div>
            <p
              style={{
                margin: 0,
                color: "#616161",
                fontSize: "13px",
              }}
            >
              Neu
            </p>

            <p
              style={{
                marginTop: "4px",
                marginBottom: 0,
                fontSize: "22px",
                fontWeight: 700,
              }}
            >
              0
            </p>
          </div>

          <div>
            <p
              style={{
                margin: 0,
                color: "#616161",
                fontSize: "13px",
              }}
            >
              In Bearbeitung
            </p>

            <p
              style={{
                marginTop: "4px",
                marginBottom: 0,
                fontSize: "22px",
                fontWeight: 700,
              }}
            >
              0
            </p>
          </div>

          <div>
            <p
              style={{
                margin: 0,
                color: "#616161",
                fontSize: "13px",
              }}
            >
              Versandbereit
            </p>

            <p
              style={{
                marginTop: "4px",
                marginBottom: 0,
                fontSize: "22px",
                fontWeight: 700,
              }}
            >
              0
            </p>
          </div>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="So funktioniert CrunchLab">
        <s-unordered-list>
          <s-list-item>
            Shopify übermittelt die Bestellung.
          </s-list-item>

          <s-list-item>
            CrunchLab erkennt die gewählten Zutaten.
          </s-list-item>

          <s-list-item>
            Die App berechnet automatisch die benötigten Gramm.
          </s-list-item>

          <s-list-item>
            Wareneinsatz und Gewinn werden automatisch berechnet.
          </s-list-item>

          <s-list-item>
            Die Bestellung wird als Produktionsauftrag angezeigt.
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};