import test from "node:test";
import assert from "node:assert/strict";
import { calculateReview, expandAttribute, parseGrams, parseLineItem, PRODUCTION_STATUSES } from "../app/order-workflow.js";

const ingredients=[{id:1,name:"Chocolate Crunch Müsli",category:"Basis",purchasePrice:4.15,stockWeight:5000,active:true,aliases:[{alias:"Choco Crunch Müsli"}]},{id:2,name:"Lotus Crunch",category:"Topping",purchasePrice:8.95,stockWeight:5000,active:true,aliases:[]}];
test("Gramm und Kilogramm werden gelesen",()=>{assert.equal(parseGrams("250 g"),250);assert.equal(parseGrams("1 kg"),1000);assert.equal(parseGrams("ohne Menge"),null)});
test("Basis und Toppings werden getrennt expandiert",()=>{const rows=expandAttribute({key:"Basis",value:"Choco Crunch Müsli - 600 g, Lotus Crunch - 400 g"});assert.equal(rows.length,2);assert.equal(rows[0].group,"basis")});
test("Alias-Mapping und Produktmenge werden korrekt multipliziert",()=>{const rows=parseLineItem({quantity:2,customAttributes:[{key:"Basis",value:"Choco Crunch Müsli - 600 g"},{key:"Toppings",value:"Lotus Crunch - 400 g"}]},ingredients);assert.deepEqual(rows.map(r=>r.totalGrams),[1200,800]);assert.ok(rows.every(r=>r.mappingStatus==="MATCHED"))});
test("Unbekannte Zutaten und Gewichtsabweichung blockieren die Freigabe",()=>{const order={paymentStatus:"PAID",lineItems:[{quantity:1}],ingredients:[{mappingStatus:"UNKNOWN",totalGrams:900,ingredient:null,name:"X"}]};const review=calculateReview(order);assert.equal(review.difference,-1000);assert.ok(review.blockingReasons.length>=2)});
test("Zahlen in unbekannten Attributen verfälschen das Produktionsgewicht nicht",()=>{const order={paymentStatus:"PAID",lineItems:[{quantity:1}],ingredients:[{mappingStatus:"MATCHED",totalGrams:1000,ingredient:ingredients[0],name:"Basis"},{mappingStatus:"UNKNOWN",totalGrams:7528.54,ingredient:null,name:"Konfigurator-ID"}]};assert.equal(calculateReview(order).total,1000)});
test("Fehlende Kundendaten beeinflussen die Produktionsprüfung nicht",()=>{const order={paymentStatus:"PAID",lineItems:[{quantity:1}],ingredients:[{mappingStatus:"MATCHED",totalGrams:1000,ingredient:ingredients[0],name:"X"}]};assert.deepEqual(calculateReview(order).blockingReasons,[])});
test("Workflow enthält jeden Schritt genau einmal",()=>{assert.equal(new Set(PRODUCTION_STATUSES).size,9);assert.equal(PRODUCTION_STATUSES.at(-1),"COMPLETED")});
