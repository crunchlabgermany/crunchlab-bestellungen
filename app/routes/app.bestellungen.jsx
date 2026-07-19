import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const [response, zutaten] = await Promise.all([
    admin.graphql(
      `#graphql
        query CrunchLabBestellungen {
          orders(first: 25, sortKey: CREATED_AT, reverse: true) {
            nodes {
              id
              name
              createdAt
              displayFinancialStatus
              displayFulfillmentStatus

              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }

              lineItems(first: 50) {
                nodes {
                  id
                  name
                  title
                  quantity

                  originalUnitPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }

                  customAttributes {
                    key
                    value
                  }
                }
              }
            }
          }
        }
      `,
    ),

    db.ingredient.findMany({
      where: {
        shop: session.shop,
        active: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  const json = await response.json();

  if (json.errors) {
    throw new Error(
      json.errors.map((fehler) => fehler.message).join(", "),
    );
  }

  return {
    bestellungen: json.data.orders.nodes,
    zutaten,
  };
};

function formatiereDatum(datum) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(datum));
}

function formatiereGeld(amount, currencyCode = "EUR") {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currencyCode,
  }).format(Number(amount || 0));
}

function normalisiereName(wert) {
  return String(wert || "")
    .trim()
    .toLocaleLowerCase("de-DE")
    .replace(/^_+/, "")
    .replace(/\s+/g, " ");
}

function leseGramm(wert) {
  const text = String(wert || "")
    .trim()
    .toLocaleLowerCase("de-DE")
    .replace(",", ".");

  const zahlTreffer = text.match(/(\d+(?:\.\d+)?)/);

  if (!zahlTreffer) {
    return null;
  }

  const zahl = Number(zahlTreffer[1]);

  if (!Number.isFinite(zahl)) {
    return null;
  }

  if (text.includes("kg")) {
    return zahl * 1000;
  }

  return zahl;
}

function findeZutat(attribut, gespeicherteZutaten) {
  const schluessel = normalisiereName(attribut.key);
  const wert = normalisiereName(attribut.value);

  return gespeicherteZutaten.find((zutat) => {
    const name = normalisiereName(zutat.name);

    return schluessel === name || wert === name;
  });
}

function ermittleMischung(lineItem, gespeicherteZutaten) {
  return (lineItem.customAttributes || [])
    .map((attribut) => {
      const gespeicherteZutat = findeZutat(
        attribut,
        gespeicherteZutaten,
      );

      if (!gespeicherteZutat) {
        return null;
      }

      const grammAusWert = leseGramm(attribut.value);
      const grammAusSchluessel = leseGramm(attribut.key);
      const gramm = grammAusWert ?? grammAusSchluessel;

      if (gramm === null || gramm <= 0) {
        return {
          name: gespeicherteZutat.name,
          kategorie: gespeicherteZutat.category,
          gramm: null,
          kosten: null,
          kilopreis: gespeicherteZutat.purchasePrice,
          originalKey: attribut.key,
          originalValue: attribut.value,
        };
      }

      const gesamteGramm =
        gramm * Math.max(Number(lineItem.quantity || 1), 1);

      const kosten =
        (gesamteGramm / 1000) *
        Number(gespeicherteZutat.purchasePrice || 0);

      return {
        name: gespeicherteZutat.name,
        kategorie: gespeicherteZutat.category,
        gramm: gesamteGramm,
        kosten,
        kilopreis: gespeicherteZutat.purchasePrice,
        originalKey: attribut.key,
        originalValue: attribut.value,
      };
    })
    .filter(Boolean);
}

function statusAufDeutsch(status) {
  const uebersetzungen = {
    PAID: "Bezahlt",
    PENDING: "Ausstehend",
    AUTHORIZED: "Autorisiert",
    PARTIALLY_PAID: "Teilweise bezahlt",
    REFUNDED: "Erstattet",
    PARTIALLY_REFUNDED: "Teilweise erstattet",
    VOIDED: "Storniert",
    UNFULFILLED: "Nicht versendet",
    PARTIALLY_FULFILLED: "Teilweise versendet",
    FULFILLED: "Versendet",
    ON_HOLD: "Zurückgestellt",
    SCHEDULED: "Geplant",
  };

  return uebersetzungen[status] || status || "Unbekannt";
}

export default function Bestellungen() {
  const { bestellungen, zutaten } = useLoaderData();

  return (
    <s-page heading="CrunchLab Bestellungen">
      <s-section>
        <s-paragraph>
          Hier werden die Kundenmischungen automatisch mit deinen
          gespeicherten Zutaten und Kilopreisen verglichen.
        </s-paragraph>
      </s-section>

      {zutaten.length === 0 && (
        <s-section>
          <s-banner tone="warning">
            Es sind noch keine aktiven Zutaten gespeichert. Lege zuerst unter
            „Zutaten“ mindestens eine Basis und ein Topping an.
          </s-banner>
        </s-section>
      )}

      {bestellungen.length === 0 ? (
        <s-section heading="Noch keine Bestellungen">
          <s-paragraph>
            Sobald eine Test- oder Kundenbestellung eingeht, erscheint sie
            hier automatisch.
          </s-paragraph>
        </s-section>
      ) : (
        bestellungen.map((bestellung) => {
          return (
            <s-section
              key={bestellung.id}
              heading={`Bestellung ${bestellung.name}`}
            >
              <div style={kopfRasterStil}>
                <div style={karteStil}>
                  <h3 style={ueberschriftStil}>Kunde</h3>

                  <p>
                    Kundendaten werden ohne die erforderliche Shopify-Freigabe
                    nicht abgefragt.
                  </p>
                </div>

                <div style={karteStil}>
                  <h3 style={ueberschriftStil}>Bestellung</h3>

                  <p>
                    <strong>Datum:</strong>{" "}
                    {formatiereDatum(bestellung.createdAt)}
                  </p>

                  <p>
                    <strong>Zahlung:</strong>{" "}
                    {statusAufDeutsch(
                      bestellung.displayFinancialStatus,
                    )}
                  </p>

                  <p>
                    <strong>Versand:</strong>{" "}
                    {statusAufDeutsch(
                      bestellung.displayFulfillmentStatus,
                    )}
                  </p>

                  <p>
                    <strong>Verkauf:</strong>{" "}
                    {formatiereGeld(
                      bestellung.totalPriceSet.shopMoney.amount,
                      bestellung.totalPriceSet.shopMoney.currencyCode,
                    )}
                  </p>
                </div>
              </div>

              {bestellung.lineItems.nodes.map((produkt) => {
                const mischung = ermittleMischung(produkt, zutaten);

                const erkannteMischung = mischung.filter(
                  (eintrag) => eintrag.gramm !== null,
                );

                const wareneinsatz = erkannteMischung.reduce(
                  (summe, eintrag) => summe + eintrag.kosten,
                  0,
                );

                const verkaufspreis =
                  Number(
                    produkt.originalUnitPriceSet.shopMoney.amount || 0,
                  ) * Number(produkt.quantity || 1);

                const gewinn = verkaufspreis - wareneinsatz;

                const gewinnProzent =
                  verkaufspreis > 0
                    ? (gewinn / verkaufspreis) * 100
                    : 0;

                return (
                  <div key={produkt.id} style={produktKarteStil}>
                    <div style={produktKopfStil}>
                      <div>
                        <h3 style={{ margin: 0 }}>
                          {produkt.name || produkt.title}
                        </h3>

                        <p style={{ marginBottom: 0 }}>
                          Anzahl: {produkt.quantity}
                        </p>
                      </div>

                      <strong>
                        {formatiereGeld(
                          verkaufspreis,
                          produkt.originalUnitPriceSet.shopMoney
                            .currencyCode,
                        )}
                      </strong>
                    </div>

                    <h4>Produktionsmischung</h4>

                    {mischung.length === 0 ? (
                      <s-banner tone="warning">
                        Es wurde noch keine Übereinstimmung zwischen der
                        Kundenmischung und deinen gespeicherten Zutaten
                        gefunden.
                      </s-banner>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={tabellenStil}>
                          <thead>
                            <tr>
                              <th style={kopfZelleStil}>Kategorie</th>
                              <th style={kopfZelleStil}>Zutat</th>
                              <th style={rechteKopfZelleStil}>Menge</th>
                              <th style={rechteKopfZelleStil}>Kilopreis</th>
                              <th style={rechteKopfZelleStil}>Kosten</th>
                            </tr>
                          </thead>

                          <tbody>
                            {mischung.map((eintrag, index) => (
                              <tr
                                key={`${produkt.id}-${eintrag.name}-${index}`}
                              >
                                <td style={zelleStil}>
                                  {eintrag.kategorie}
                                </td>

                                <td style={zelleStil}>
                                  {eintrag.name}
                                </td>

                                <td style={rechteZelleStil}>
                                  {eintrag.gramm === null
                                    ? "Grammangabe fehlt"
                                    : `${eintrag.gramm.toLocaleString(
                                        "de-DE",
                                      )} g`}
                                </td>

                                <td style={rechteZelleStil}>
                                  {formatiereGeld(eintrag.kilopreis)}
                                </td>

                                <td style={rechteZelleStil}>
                                  {eintrag.kosten === null
                                    ? "–"
                                    : formatiereGeld(eintrag.kosten)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div style={kalkulationsRasterStil}>
                      <div style={infoKarteStil}>
                        <span style={infoTitelStil}>
                          Verkaufspreis
                        </span>
                        <strong>{formatiereGeld(verkaufspreis)}</strong>
                      </div>

                      <div style={infoKarteStil}>
                        <span style={infoTitelStil}>
                          Zutatenkosten
                        </span>
                        <strong>{formatiereGeld(wareneinsatz)}</strong>
                      </div>

                      <div style={infoKarteStil}>
                        <span style={infoTitelStil}>Rohgewinn</span>
                        <strong>{formatiereGeld(gewinn)}</strong>
                      </div>

                      <div style={infoKarteStil}>
                        <span style={infoTitelStil}>
                          Rohgewinn in Prozent
                        </span>
                        <strong>
                          {gewinnProzent.toLocaleString("de-DE", {
                            maximumFractionDigits: 1,
                          })}
                          %
                        </strong>
                      </div>
                    </div>

                    <details style={{ marginTop: "18px" }}>
                      <summary>
                        Originaldaten aus dem Müsli-Konfigurator anzeigen
                      </summary>

                      <pre style={datenStil}>
                        {JSON.stringify(
                          produkt.customAttributes,
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </div>
                );
              })}
            </s-section>
          );
        })
      )}
    </s-page>
  );
}

const kopfRasterStil = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: "16px",
};

const karteStil = {
  padding: "16px",
  border: "1px solid #dedede",
  borderRadius: "12px",
};

const ueberschriftStil = {
  marginTop: 0,
};

const produktKarteStil = {
  marginTop: "20px",
  padding: "18px",
  border: "1px solid #dedede",
  borderRadius: "14px",
};

const produktKopfStil = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  flexWrap: "wrap",
  gap: "12px",
};

const tabellenStil = {
  width: "100%",
  borderCollapse: "collapse",
};

const kopfZelleStil = {
  padding: "10px",
  textAlign: "left",
  borderBottom: "1px solid #dedede",
};

const rechteKopfZelleStil = {
  ...kopfZelleStil,
  textAlign: "right",
};

const zelleStil = {
  padding: "10px",
  borderBottom: "1px solid #eeeeee",
};

const rechteZelleStil = {
  ...zelleStil,
  textAlign: "right",
};

const kalkulationsRasterStil = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "10px",
  marginTop: "18px",
};

const infoKarteStil = {
  display: "flex",
  flexDirection: "column",
  gap: "5px",
  padding: "12px",
  borderRadius: "9px",
  background: "#f5f5f5",
};

const infoTitelStil = {
  color: "#616161",
  fontSize: "12px",
};

const datenStil = {
  overflowX: "auto",
  marginTop: "10px",
  padding: "12px",
  borderRadius: "8px",
  background: "#f5f5f5",
};

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
