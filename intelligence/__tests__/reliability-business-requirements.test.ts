import assert from "node:assert/strict";
import { runPipeline } from "../pipeline";

const brdText = `
Business Requirements Document

Executive Summary
Mala Bowl currently operates using traditional, manual workflows for customer ordering, counter checkout, and kitchen preparation. These legacy methods lead to severe wait-time delays, pricing inaccuracies, kitchen miscommunication, and a lack of structured analytics.

Full Story
Customers manually select ingredients and carry them to the cashier. The cashier weighs the ingredients, calculates the price, writes the order details on paper, and passes the bowl and ticket to kitchen staff.

Business Objectives
Service Objectives
Provide customers with freshly prepared and customizable Mala Xiang Guo meals.
Serve customers according to their selected ingredients, soup type, and spice level.
Product Objectives
Offer a variety of fresh ingredients for customers to choose from.
Deliver complete and accurate customer orders.

Functional Requirements
MoSCoW priority coding: M = Must have, S = Should have, C = Could have, W = Won't have.
FR1.0 M The system shall support customer ordering and meal customization.
FR1.1 M The system shall allow customers to select ingredients from the display fridge.
FR1.2 M The system shall allow customers to choose a soup type and spice level.
FR2.0 M The system shall support order processing and payment at the counter.
FR2.1 M The system shall record the customer order details on the paper order ticket.
FR3.0 M The system shall support meal preparation in the kitchen.

Use Case Diagram
Customer Cashier Kitchen Staff
Activity Diagram
Select ingredients
Carry ingredients to counter
Weigh ingredients manually
Calculate price manually
Write order details on paper
Make payment
Pass bowl and ticket to kitchen
Read paper ticket
Prepare meal
Serve meal
Collect prepared meal
Data Flow Diagram
DFD-1 Mala Bowl Ordering Process
Class Diagram
Customer IngredientBowl Ingredient Cashier Payment SalesRecord KitchenStaff PaperOrderTicket Meal
Object Diagram
customerA bowlA cashier1 paymentA ticketA chefKyaw mealA

Appendices
BRD Business Requirements Document
FR Functional requirement
DFD Data flow diagram
UML Unified Modeling Language
`;

describe("business-requirements reliability", () => {
  test("extracts a BRD as structured requirements knowledge instead of research-paper fields", () => {
    const result = runPipeline({
      rawText: brdText,
      fileName: "Business_Requirements_Document_MalaBowl.pdf",
      mimeType: "application/pdf",
      fileSize: 12_000,
      pageCount: 12,
    });

    const profile = result.reliabilityProfile;
    const requirements = profile.requirementsDocument;

    assert.equal(result.profile.kind, "project_report");
    assert.equal(result.profile.subtype, "business_requirements_document");
    assert.equal(profile.classification.kind, "report");
    assert.equal(profile.classification.domain, "business");
    assert.equal(profile.classification.taskType, "business_requirements_analysis");
    assert.ok(requirements);
    assert.ok(requirements.objectives.length >= 4);
    assert.ok(requirements.requirements.length >= 6);
    assert.deepEqual(requirements.actors.slice(0, 3), ["Customer", "Cashier", "Kitchen Staff"]);
    assert.ok(requirements.diagramTypes.includes("Data Flow Diagram"));
    assert.ok(requirements.diagramTypes.includes("Class Diagram"));
    assert.ok(requirements.processSteps.length >= 6);
    assert.ok(profile.keyTerms.some((term) => term.term === "BRD"));
    assert.ok(profile.keyTerms.some((term) => term.term === "DFD"));
    assert.ok(result.knowledge.keyPoints.some((point) => point.label.startsWith("FR1.0")));
    assert.equal(result.knowledge.fieldStates.method, "not_applicable");
    assert.equal(result.knowledge.fieldStates.result, "not_applicable");
    assert.ok(
      !profile.concepts.some((concept) => /system shall|shall allow|requirement definition/i.test(concept.term)),
    );
  });
});
