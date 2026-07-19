import { authenticate } from "../shopify.server"; export const loader=async({request})=>{await authenticate.admin(request);return null};
export default function Einstellungen(){return <s-page heading="Einstellungen"><s-section><s-paragraph>Vorbereitetes Modul für Verpackungs-, Versand- und Benachrichtigungseinstellungen.</s-paragraph></s-section></s-page>}
