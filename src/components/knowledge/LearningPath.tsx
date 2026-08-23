"use client";

import {
  BookOpen,
  ChevronRight,
  Layers3,
  Lightbulb,
} from "lucide-react";
import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from "./types";
import {
  asNumber,
  getNodeDescription,
  nodeConfidence,
} from "./knowledge-graph.utils";
import { useLanguage } from "@/context/LanguageContext";

interface LearningPathProps {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  onOpen: (nodeId: string) => void;
}

interface SectionStep {
  node: KnowledgeGraphNode;
  concepts: KnowledgeGraphNode[];
}

export function LearningPath({
  nodes,
  edges,
  onOpen,
}: LearningPathProps) {
  const { t } = useLanguage();
  const sections = nodes
    .filter((node) => node.type === "section")
    .sort(
      (a, b) =>
        (asNumber(a.properties?.learningOrder) ?? 999) -
        (asNumber(b.properties?.learningOrder) ?? 999),
    );

  const steps: SectionStep[] = sections.map(
    (section) => {
      const childIds = new Set(
        edges
          .filter(
            (edge) =>
              edge.from === section.id &&
              edge.type === "contains",
          )
          .map((edge) => edge.to),
      );

      const concepts = nodes
        .filter(
          (node) =>
            childIds.has(node.id) &&
            [
              "concept",
              "method",
              "claim",
              "result",
            ].includes(node.type),
        )
        .sort((a, b) => {
          const aKey =
            nodeConfidence(a) ??
            asNumber(a.properties?.score) ??
            0;
          const bKey =
            nodeConfidence(b) ??
            asNumber(b.properties?.score) ??
            0;
          return bKey - aKey;
        })
        .slice(0, 6);

      return {
        node: section,
        concepts,
      };
    },
  );

  if (steps.length === 0) {
    const concepts = nodes
      .filter((node) => node.type === "concept")
      .sort(
        (a, b) =>
          (nodeConfidence(b) ?? 0) -
          (nodeConfidence(a) ?? 0),
      )
      .slice(0, 12);

    return (
      <div className="rounded-2xl border border-[#E6DDC8] bg-white p-5">
        <h2 className="font-serif text-[18px] font-semibold text-[#221F1A]">
          {t("knowledge.keyConcepts")}
        </h2>
        <p className="mt-1 text-[12px] text-[#726B5C]">
          {t("knowledge.legacyDescription")}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {concepts.map((concept) => (
            <button
              key={concept.id}
              type="button"
              onClick={() => onOpen(concept.id)}
              className="rounded-xl border border-[#E6DDC8] bg-[#FFFCF6] p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="font-medium text-[#38342C]">
                {concept.label}
              </p>
              <p className="mt-2 line-clamp-3 text-[12px] leading-5 text-[#726B5C]">
                {getNodeDescription(concept)}
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#D7E4FF] bg-[#F4F8FF] p-4">
        <div className="flex items-start gap-3">
          <Lightbulb
            size={18}
            className="mt-0.5 shrink-0 text-[#4D7DF3]"
          />
          <div>
            <p className="text-[13px] font-semibold text-[#255FD6]">
              {t("knowledge.followOrder")}
            </p>
            <p className="mt-1 text-[12px] leading-5 text-[#5F6F91]">
              {t("knowledge.followOrderDescription")}
            </p>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="absolute bottom-8 left-[21px] top-8 w-px bg-[#DDD4C1]" />

        <div className="space-y-4">
          {steps.map((step, index) => {
            const pageNumber = asNumber(
              step.node.properties?.pageNumber,
            );

            return (
              <section
                key={step.node.id}
                className="relative pl-14"
              >
                <div className="absolute left-0 top-5 flex h-11 w-11 items-center justify-center rounded-full border-4 border-[#FAF6EC] bg-[#221F1A] font-mono text-[11px] font-semibold text-white">
                  {index + 1}
                </div>

                <div className="rounded-2xl border border-[#E6DDC8] bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9B7221]">
                        <Layers3 size={13} />
                        {t("knowledge.learningSection")}
                      </div>

                      <h3 className="mt-2 font-serif text-[19px] font-semibold text-[#221F1A]">
                        {step.node.label}
                      </h3>
                    </div>

                    {pageNumber && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F4EFE4] px-2.5 py-1 text-[10px] text-[#726B5C]">
                        <BookOpen size={11} />
                        {t("knowledge.page", { page: pageNumber })}
                      </span>
                    )}
                  </div>

                  {step.concepts.length > 0 ? (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {step.concepts.map((concept) => (
                        <button
                          key={concept.id}
                          type="button"
                          onClick={() =>
                            onOpen(concept.id)
                          }
                          className="group rounded-xl border border-[#EFE8D6] bg-[#FFFCF6] p-3.5 text-left transition hover:border-[#CFC1A2] hover:bg-white"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[12.5px] font-semibold leading-5 text-[#38342C]">
                              {concept.label}
                            </p>

                            <ChevronRight
                              size={14}
                              className="mt-0.5 shrink-0 text-[#B3A98F] transition group-hover:translate-x-0.5 group-hover:text-[#4D7DF3]"
                            />
                          </div>

                          <p className="mt-1.5 line-clamp-3 text-[11.5px] leading-5 text-[#726B5C]">
                            {getNodeDescription(concept)}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-[12px] text-[#726B5C]">
                      {t("knowledge.noSectionConcepts")}
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
