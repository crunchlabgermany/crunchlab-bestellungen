import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const zutaten = await db.ingredient.findMany({
    where: {
      shop: session.shop,
    },
    orderBy: [
      {
        active: "desc",
      },
      {
        name: "asc",
      },
    ],
  });

  return {
    zutaten,
  };
};

function leseText(formData, feldname) {
  return String(formData.get(feldname) || "").trim();
}

function leseZahl(formData, feldname) {
  const roherWert = leseText(formData, feldname).replace(",", ".");
  const zahl = Number(roherWert);

  return Number.isFinite(zahl) ? zahl : NaN;
}

function pruefeZutatenDaten(formData) {
  const name = leseText(formData, "name");
  const category = leseText(formData, "category");
  const supplier = leseText(formData, "supplier");

  const purchaseWeight = leseZahl(formData, "purchaseWeight");
  const purchasePrice = leseZahl(formData, "purchasePrice");
  const stockWeight = leseZahl(formData, "stockWeight");
  const minimumStock = leseZahl(formData, "minimumStock");

  if (!name) {
    return {
      fehler: "Bitte gib einen Namen für die Zutat ein.",
    };
  }

  if (!category) {
    return {
      fehler: "Bitte wähle eine Kategorie aus.",
    };
  }

  if (!Number.isFinite(purchaseWeight) || purchaseWeight <= 0) {
    return {
      fehler: "Die Einkaufsmenge muss größer als 0 Gramm sein.",
    };
  }

  if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
    return {
      fehler: "Bitte gib einen gültigen Einkaufspreis ein.",
    };
  }

  if (!Number.isFinite(stockWeight) || stockWeight < 0) {
    return {
      fehler: "Bitte gib einen gültigen Lagerbestand ein.",
    };
  }

  if (!Number.isFinite(minimumStock) || minimumStock < 0) {
    return {
      fehler: "Bitte gib einen gültigen Mindestbestand ein.",
    };
  }

  return {
    daten: {
      name,
      category,
      supplier: supplier || null,
      purchaseWeight,
      purchasePrice,
      stockWeight,
      minimumStock,
    },
  };
}

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = leseText(formData, "intent");

  try {
    if (intent === "create") {
      const pruefung = pruefeZutatenDaten(formData);

      if (pruefung.fehler) {
        return {
          ok: false,
          fehler: pruefung.fehler,
        };
      }

      await db.ingredient.create({
        data: {
          shop: session.shop,
          ...pruefung.daten,
          active: true,
        },
      });

      return {
        ok: true,
        meldung: "Die Zutat wurde gespeichert.",
      };
    }

    if (intent === "update") {
      const id = Number(formData.get("id"));
      const pruefung = pruefeZutatenDaten(formData);

      if (!Number.isInteger(id)) {
        return {
          ok: false,
          fehler: "Die Zutat konnte nicht gefunden werden.",
        };
      }

      if (pruefung.fehler) {
        return {
          ok: false,
          fehler: pruefung.fehler,
        };
      }

      const vorhandeneZutat = await db.ingredient.findFirst({
        where: {
          id,
          shop: session.shop,
        },
      });

      if (!vorhandeneZutat) {
        return {
          ok: false,
          fehler: "Die Zutat konnte nicht gefunden werden.",
        };
      }

      await db.ingredient.update({
        where: {
          id,
        },
        data: pruefung.daten,
      });

      return {
        ok: true,
        meldung: "Die Änderungen wurden gespeichert.",
      };
    }

    if (intent === "toggle") {
      const id = Number(formData.get("id"));

      const vorhandeneZutat = await db.ingredient.findFirst({
        where: {
          id,
          shop: session.shop,
        },
      });

      if (!vorhandeneZutat) {
        return {
          ok: false,
          fehler: "Die Zutat konnte nicht gefunden werden.",
        };
      }

      await db.ingredient.update({
        where: {
          id,
        },
        data: {
          active: !vorhandeneZutat.active,
        },
      });

      return {
        ok: true,
        meldung: vorhandeneZutat.active
          ? "Die Zutat wurde deaktiviert."
          : "Die Zutat wurde aktiviert.",
      };
    }

    if (intent === "delete") {
      const id = Number(formData.get("id"));

      const vorhandeneZutat = await db.ingredient.findFirst({
        where: {
          id,
          shop: session.shop,
        },
      });

      if (!vorhandeneZutat) {
        return {
          ok: false,
          fehler: "Die Zutat konnte nicht gefunden werden.",
        };
      }

      await db.ingredient.delete({
        where: {
          id,
        },
      });

      return {
        ok: true,
        meldung: "Die Zutat wurde gelöscht.",
      };
    }

    return {
      ok: false,
      fehler: "Die Aktion wurde nicht erkannt.",
    };
  } catch (error) {
    console.error("Fehler bei der Zutatenverwaltung:", error);

    if (
      error?.code === "P2002" ||
      String(error?.message || "").includes("Unique constraint")
    ) {
      return {
        ok: false,
        fehler:
          "Eine Zutat mit diesem Namen ist bereits vorhanden. Bitte bearbeite den vorhandenen Eintrag.",
      };
    }

    return {
      ok: false,
      fehler: "Beim Speichern ist ein Fehler aufgetreten.",
    };
  }
};

function formatiereEuro(wert) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(wert || 0));
}

function formatiereGramm(wert) {
  return `${new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
  }).format(Number(wert || 0))} g`;
}

function istBestandNiedrig(zutat) {
  return (
    zutat.minimumStock > 0 &&
    zutat.stockWeight <= zutat.minimumStock
  );
}

export default function Zutaten() {
  const { zutaten } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();

  const wirdGespeichert = navigation.state === "submitting";

  const aktiveZutaten = zutaten.filter((zutat) => zutat.active);
  const inaktiveZutaten = zutaten.filter((zutat) => !zutat.active);
  const niedrigerBestand = zutaten.filter(
    (zutat) => zutat.active && istBestandNiedrig(zutat),
  );

  return (
    <s-page heading="CrunchLab Zutaten">
      <s-section>
        <s-paragraph>
          Hier verwaltest du alle Zutaten, Einkaufspreise und Lagerbestände.
          Der Preis pro Gramm wird automatisch berechnet.
        </s-paragraph>
      </s-section>

      {actionData?.meldung && (
        <s-section>
          <s-banner tone="success">
            {actionData.meldung}
          </s-banner>
        </s-section>
      )}

      {actionData?.fehler && (
        <s-section>
          <s-banner tone="critical">
            {actionData.fehler}
          </s-banner>
        </s-section>
      )}

      <s-section heading="Übersicht">
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
          }}
        >
          <div style={kartenStil}>
            <div style={kartenTitelStil}>Aktive Zutaten</div>
            <div style={kartenWertStil}>{aktiveZutaten.length}</div>
          </div>

          <div style={kartenStil}>
            <div style={kartenTitelStil}>Inaktive Zutaten</div>
            <div style={kartenWertStil}>{inaktiveZutaten.length}</div>
          </div>

          <div style={kartenStil}>
            <div style={kartenTitelStil}>Niedriger Bestand</div>
            <div style={kartenWertStil}>{niedrigerBestand.length}</div>
          </div>
        </div>
      </s-section>

      <s-section heading="Neue Zutat hinzufügen">
        <Form method="post">
          <input type="hidden" name="intent" value="create" />

          <div style={formularRasterStil}>
            <label style={feldStil}>
              <span style={beschriftungStil}>Name der Zutat</span>
              <input
                required
                name="name"
                type="text"
                placeholder="Zum Beispiel Haferflocken"
                style={eingabeStil}
              />
            </label>

            <label style={feldStil}>
              <span style={beschriftungStil}>Kategorie</span>
              <select
                required
                name="category"
                defaultValue=""
                style={eingabeStil}
              >
                <option value="" disabled>
                  Kategorie auswählen
                </option>
                <option value="Basis">Basis</option>
<option value="Topping">Topping</option>
              </select>
            </label>

            <input
  type="hidden"
  name="purchaseWeight"
  value="1000"
/>

            <label style={feldStil}>
             <span style={beschriftungStil}>
  Einkaufspreis in Euro pro kg
</span>
              <input
                required
                name="purchasePrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="Zum Beispiel 18,90"
                style={eingabeStil}
              />
            </label>

            <label style={feldStil}>
              <span style={beschriftungStil}>
                Aktueller Lagerbestand in Gramm
              </span>
              <input
                required
                name="stockWeight"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                style={eingabeStil}
              />
            </label>

            <input type="hidden" name="minimumStock" value="0" />

            <label style={feldStil}>
              <span style={beschriftungStil}>
                Lieferant, optional
              </span>
              <input
                name="supplier"
                type="text"
                placeholder="Name des Lieferanten"
                style={eingabeStil}
              />
            </label>
          </div>

          <div style={{ marginTop: "16px" }}>
            <button
              type="submit"
              disabled={wirdGespeichert}
              style={primaerButtonStil}
            >
              {wirdGespeichert
                ? "Wird gespeichert …"
                : "Zutat hinzufügen"}
            </button>
          </div>
        </Form>
      </s-section>

      <s-section heading="Gespeicherte Zutaten">
        {zutaten.length === 0 ? (
          <s-box
            padding="large"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-heading>Noch keine Zutaten gespeichert</s-heading>

            <s-paragraph>
              Füge oben deine erste CrunchLab-Zutat hinzu.
            </s-paragraph>
          </s-box>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "16px",
            }}
          >
            {zutaten.map((zutat) => {
              const niedrigerBestand =
                istBestandNiedrig(zutat);

              return (
                <div
                  key={zutat.id}
                  style={{
                    padding: "18px",
                    border: niedrigerBestand
                      ? "2px solid #e0a000"
                      : "1px solid #dedede",
                    borderRadius: "14px",
                    background: zutat.active
                      ? "#ffffff"
                      : "#f4f4f4",
                    opacity: zutat.active ? 1 : 0.7,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: "12px",
                      marginBottom: "16px",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: "18px",
                        }}
                      >
                        {zutat.name}
                      </h3>

                      <div
                        style={{
                          marginTop: "6px",
                          color: "#616161",
                          fontSize: "14px",
                        }}
                      >
                        {zutat.category}
                        {zutat.supplier
                          ? ` · Lieferant: ${zutat.supplier}`
                          : ""}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          ...statusStil,
                          background: zutat.active
                            ? "#dff7e5"
                            : "#e8e8e8",
                        }}
                      >
                        {zutat.active ? "Aktiv" : "Inaktiv"}
                      </span>

                      {niedrigerBestand && (
                        <span
                          style={{
                            ...statusStil,
                            background: "#fff1c7",
                          }}
                        >
                          Bestand niedrig
                        </span>
                      )}
                    </div>
                  </div>

                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value="update"
                    />
                    <input
                      type="hidden"
                      name="id"
                      value={zutat.id}
                    />

                    <div style={formularRasterStil}>
                      <label style={feldStil}>
                        <span style={beschriftungStil}>Name</span>
                        <input
                          required
                          name="name"
                          type="text"
                          defaultValue={zutat.name}
                          style={eingabeStil}
                        />
                      </label>

                      <label style={feldStil}>
                        <span style={beschriftungStil}>
                          Kategorie
                        </span>
                        <select
                          required
                          name="category"
                          defaultValue={zutat.category}
                          style={eingabeStil}
                        >
                         <option value="Basis">Basis</option>
<option value="Topping">Topping</option>
                  
                        </select>
                      </label>

                     <input type="hidden" name="purchaseWeight" value="1000" />

                      <label style={feldStil}>
                        <span style={beschriftungStil}>
                          Einkaufspreis
                        </span>
                        <input
                          required
                          name="purchasePrice"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={zutat.purchasePrice}
                          style={eingabeStil}
                        />
                      </label>

                      <label style={feldStil}>
                        <span style={beschriftungStil}>
                          Lagerbestand
                        </span>
                        <input
                          required
                          name="stockWeight"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={zutat.stockWeight}
                          style={eingabeStil}
                        />
                      </label>

                      <label style={feldStil}>
                        <span style={beschriftungStil}>
                          Mindestbestand
                        </span>
                        <input
                          required
                          name="minimumStock"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={zutat.minimumStock}
                          style={eingabeStil}
                        />
                      </label>

                      <label style={feldStil}>
                        <span style={beschriftungStil}>
                          Lieferant
                        </span>
                        <input
                          name="supplier"
                          type="text"
                          defaultValue={zutat.supplier || ""}
                          style={eingabeStil}
                        />
                      </label>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(170px, 1fr))",
                        gap: "10px",
                        marginTop: "16px",
                      }}
                    >
                      <div style={infoFeldStil}>
  <span style={infoTitelStil}>
    Einkaufspreis pro kg
  </span>

  <strong>
    {formatiereEuro(zutat.purchasePrice)}
  </strong>
</div>

                    


                      <div style={infoFeldStil}>
                        <span style={infoTitelStil}>
                          Lagerbestand
                        </span>
                        <strong>
                          {formatiereGramm(zutat.stockWeight)}
                        </strong>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "10px",
                        marginTop: "16px",
                      }}
                    >
                      <button
                        type="submit"
                        disabled={wirdGespeichert}
                        style={primaerButtonStil}
                      >
                        Änderungen speichern
                      </button>
                    </div>
                  </Form>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "10px",
                      marginTop: "10px",
                    }}
                  >
                    <Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value="toggle"
                      />
                      <input
                        type="hidden"
                        name="id"
                        value={zutat.id}
                      />

                      <button
                        type="submit"
                        disabled={wirdGespeichert}
                        style={sekundaerButtonStil}
                      >
                        {zutat.active
                          ? "Zutat deaktivieren"
                          : "Zutat aktivieren"}
                      </button>
                    </Form>

                    <Form
                      method="post"
                      onSubmit={(event) => {
                        const bestaetigt = window.confirm(
                          `Soll „${zutat.name}“ wirklich endgültig gelöscht werden?`,
                        );

                        if (!bestaetigt) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input
                        type="hidden"
                        name="intent"
                        value="delete"
                      />
                      <input
                        type="hidden"
                        name="id"
                        value={zutat.id}
                      />

                      <button
                        type="submit"
                        disabled={wirdGespeichert}
                        style={loeschenButtonStil}
                      >
                        Zutat löschen
                      </button>
                    </Form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </s-section>
    </s-page>
  );
}

const kartenStil = {
  padding: "16px",
  border: "1px solid #dedede",
  borderRadius: "12px",
  background: "#ffffff",
};

const kartenTitelStil = {
  color: "#616161",
  fontSize: "13px",
};

const kartenWertStil = {
  marginTop: "6px",
  fontSize: "26px",
  fontWeight: 700,
};

const formularRasterStil = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px",
};

const feldStil = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const beschriftungStil = {
  fontSize: "14px",
  fontWeight: 600,
};

const eingabeStil = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid #b8b8b8",
  borderRadius: "8px",
  background: "#ffffff",
  fontSize: "14px",
};

const primaerButtonStil = {
  padding: "10px 16px",
  border: "none",
  borderRadius: "8px",
  background: "#303030",
  color: "#ffffff",
  fontWeight: 600,
  cursor: "pointer",
};

const sekundaerButtonStil = {
  padding: "10px 16px",
  border: "1px solid #b8b8b8",
  borderRadius: "8px",
  background: "#ffffff",
  color: "#303030",
  fontWeight: 600,
  cursor: "pointer",
};

const loeschenButtonStil = {
  padding: "10px 16px",
  border: "1px solid #c90000",
  borderRadius: "8px",
  background: "#ffffff",
  color: "#c90000",
  fontWeight: 600,
  cursor: "pointer",
};

const statusStil = {
  padding: "5px 9px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 600,
};

const infoFeldStil = {
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

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
