"use client";

import {
  BookOpen,
  ChevronDown,
  GitBranch,
  ShieldCheck,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type {
  EvidenceItem,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from "./types";
import {
  extractNodeEvidence,
  formatProperty,
  getNodeDescription,
  nodeColor,
  nodeConfidence,
  nodeProvenance,
  readableType,
  relationExplanation,
  relationLabel,
} from "./knowledge-graph.utils";
import { useLanguage } from "@/context/LanguageContext";

type InspectorTab =
  | "understand"
  | "connections"
  | "evidence";

interface KnowledgeInspectorProps {
  node: KnowledgeGraphNode;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  onClose?: () => void;
  compact?: boolean;
}

function technicalEntries(
  node: KnowledgeGraphNode,
): Array<[string, unknown]> {
  const hidden = new Set([
    "evidence",
    "description",
    "definition",
    "summary",
    "explanation",
    "provenance",
    "learningRole",
    "sectionIds",
    "evidenceIds",
  ]);

  return Object.entries(node.properties ?? {})
    .filter(([key]) => !hidden.has(key))
    .slice(0, 12);
}

export function KnowledgeInspector({
  node,
  nodes,
  edges,
  onClose,
  compact = false,
}: KnowledgeInspectorProps) {
  const { t } = useLanguage();
  const [tab, setTab] =
    useState<InspectorTab>("understand");
  const [showTechnical, setShowTechnical] =
    useState(false);

  const confidence = nodeConfidence(node);
  const evidence = extractNodeEvidence(node);
  const accent = nodeColor(node.type);
  const provenance = nodeProvenance(node);

  const connections = useMemo(
    () =>
      edges
        .filter(
          (edge) =>
            edge.from === node.id ||
            edge.to === node.id,
        )
        .map((edge) => {
          const otherId =
            edge.from === node.id
              ? edge.to
              : edge.from;

          return {
            edge,
            node:
              nodes.find(
                (candidate) =>
                  candidate.id === otherId,
              ) ?? null,
            direction:
              edge.from === node.id
                ? "outgoing"
                : "incoming",
          } as const;
        }),
    [edges, node.id, nodes],
  );

  const meaningfulConnections = connections.filter(
    ({ node: connectedNode }) =>
      connectedNode &&
      connectedNode.type !== "paper",
  );

  const tabs: Array<{
    id: InspectorTab;
    label: string;
    count?: number;
  }> = [
    {
      id: "understand",
      label: t("knowledge.inspector.understand"),
    },
    {
      id: "connections",
      label: t("knowledge.inspector.connections"),
      count: meaningfulConnections.length,
    },
    {
      id: "evidence",
      label: t("knowledge.inspector.source"),
      count: evidence.length,
    },
  ];

  return (
    <aside
      className={[
        "overflow-hidden rounded-[10px] border border-line bg-paper-raised",
        compact
          ? "max-h-[72vh]"
          : "sticky top-5 max-h-[calc(100vh-40px)]",
      ].join(" ")}
    >
      <div className="border-b border-[#EFE8D6] px-5 pb-0 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="max-w-[245px] break-words font-serif text-[18px] font-semibold leading-6 text-ink">
                {node.label}
              </h2>

              <span
                className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  color: accent,
                  background: `${accent}18`,
                }}
              >
                {readableType(node.type)}
              </span>
            </div>

            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-2 py-1 text-[10px] font-medium text-sage">
              <ShieldCheck size={11} />
              {provenance === "ai_grounded"
                ? t("knowledge.inspector.aiGrounded")
                : t("knowledge.inspector.documentGrounded")}
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-soft hover:bg-line-soft"
              aria-label={t("knowledge.inspector.close")}
            >
              <X size={17} />
            </button>
          )}
        </div>

        <div className="mt-5 flex gap-4 overflow-x-auto">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={[
                "whitespace-nowrap border-b-2 pb-3 text-[11.5px] font-medium transition",
                tab === item.id
                  ? "border-violet text-violet"
                  : "border-transparent text-ink-soft hover:text-ink",
              ].join(" ")}
            >
              {item.label}
              {typeof item.count === "number" &&
                ` (${item.count})`}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[calc(100vh-190px)] overflow-y-auto p-5">
        {tab === "understand" && (
          <div className="space-y-5">
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                {t("knowledge.inspector.meaning")}
              </h3>

              <p className="mt-2 text-[13px] leading-6 text-ink">
                {getNodeDescription(node)}
              </p>
            </section>

            {meaningfulConnections.length > 0 && (
              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                  {t("knowledge.inspector.fits")}
                </h3>

                <div className="mt-2 space-y-2">
                  {meaningfulConnections
                    .slice(0, 4)
                    .map(
                      ({
                        edge,
                        node: connectedNode,
                        direction,
                      }) => {
                        if (!connectedNode) {
                          return null;
                        }

                        return (
                          <button
                            key={`${edge.from}-${edge.type}-${edge.to}`}
                            type="button"
                            onClick={() =>
                              setTab("connections")
                            }
                            className="w-full rounded-[8px] border border-[#EFE8D6] bg-paper px-3 py-2.5 text-left"
                          >
                            <p className="text-[11.5px] leading-5 text-ink-soft">
                              {direction === "outgoing"
                                ? relationExplanation(
                                    edge,
                                    node.label,
                                    connectedNode.label,
                                  )
                                : relationExplanation(
                                    edge,
                                    connectedNode.label,
                                    node.label,
                                  )}
                            </p>
                          </button>
                        );
                      },
                    )}
                </div>
              </section>
            )}

            {typeof confidence === "number" &&
              node.type !== "section" && (
                <section>
                  <div className="flex items-center justify-between text-[11px] font-medium text-ink-soft">
                    <span>{t("knowledge.sourceConfidence")}</span>
                    <span>
                      {Math.round(confidence * 100)}%
                    </span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-line-soft">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(
                            100,
                            confidence * 100,
                          ),
                        )}%`,
                        background: accent,
                      }}
                    />
                  </div>
                </section>
              )}

            {evidence.length > 0 && (
              <button
                type="button"
                onClick={() => setTab("evidence")}
                className="flex w-full items-center justify-between rounded-[8px] border border-violet/25 bg-violet-soft/45 px-4 py-3 text-left hover:bg-violet-soft"
              >
                <span className="flex items-center gap-2 text-[12px] font-medium text-violet">
                  <BookOpen size={15} />
                  {t("knowledge.inspector.showEvidence")}
                </span>

                <span className="text-[12px] text-slate">
                  {evidence.length}
                </span>
              </button>
            )}

            <section>
              <button
                type="button"
                onClick={() =>
                  setShowTechnical((current) => !current)
                }
                className="flex w-full items-center justify-between rounded-[8px] border border-line px-3 py-2.5 text-[11.5px] font-medium text-ink-soft hover:bg-[#FAF6EC]"
              >
                {t("knowledge.inspector.technical")}
                <ChevronDown
                  size={14}
                  className={
                    showTechnical
                      ? "rotate-180 transition"
                      : "transition"
                  }
                />
              </button>

              {showTechnical && (
                <dl className="mt-2 divide-y divide-[#EFE8D6] rounded-[8px] border border-[#EFE8D6] px-3">
                  <div className="grid grid-cols-[100px_1fr] gap-3 py-2.5 text-[11.5px]">
                    <dt className="text-ink-soft">
                      {t("knowledge.inspector.type")}
                    </dt>
                    <dd className="font-medium text-ink">
                      {readableType(node.type)}
                    </dd>
                  </div>

                  {technicalEntries(node).map(
                    ([key, value]) => (
                      <div
                        key={key}
                        className="grid grid-cols-[100px_1fr] gap-3 py-2.5 text-[11.5px]"
                      >
                        <dt className="break-words text-ink-soft">
                          {readableType(key)}
                        </dt>
                        <dd className="break-words font-medium text-ink">
                          {formatProperty(value)}
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
              )}
            </section>
          </div>
        )}

        {tab === "connections" && (
          <div className="space-y-3">
            {meaningfulConnections.length === 0 ? (
              <p className="text-[13px] text-ink-soft">
                {t("knowledge.inspector.noRelationship")}
              </p>
            ) : (
              meaningfulConnections.map(
                ({
                  edge,
                  node: connectedNode,
                  direction,
                }) => {
                  if (!connectedNode) return null;

                  const explanation =
                    direction === "outgoing"
                      ? relationExplanation(
                          edge,
                          node.label,
                          connectedNode.label,
                        )
                      : relationExplanation(
                          edge,
                          connectedNode.label,
                          node.label,
                        );

                  return (
                    <div
                      key={`${edge.from}-${edge.type}-${edge.to}`}
                      className="rounded-[8px] border border-line p-3.5"
                    >
                      <div className="flex items-start gap-3">
                        <GitBranch
                          size={15}
                          className="mt-0.5 shrink-0 text-violet"
                        />

                        <div>
                          <p className="text-[12.5px] font-semibold text-ink">
                            {connectedNode.label}
                          </p>

                          <p className="mt-1 text-[11.5px] leading-5 text-ink-soft">
                            {explanation}
                          </p>

                          <span className="mt-2 inline-block rounded-full bg-line-soft px-2 py-1 text-[10px] text-ink-soft">
                            {relationLabel(edge.type)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                },
              )
            )}
          </div>
        )}

        {tab === "evidence" && (
          <EvidenceList evidence={evidence} />
        )}
      </div>
    </aside>
  );
}

function EvidenceList({
  evidence,
}: {
  evidence: EvidenceItem[];
}) {
  const { t } = useLanguage();

  if (evidence.length === 0) {
    return (
      <p className="text-[13px] text-ink-soft">
        {t("knowledge.inspector.noSource")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {evidence.map((item) => (
        <article
          key={item.id}
          className="rounded-[8px] border border-line bg-paper p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-paper-raised px-2 py-1 text-[10px] font-medium text-ink-soft">
              <BookOpen size={12} />
              {item.pageNumber
                ? t("knowledge.page", { page: item.pageNumber })
                : t("knowledge.documentEvidence")}
            </span>

            {item.sectionTitle && (
              <span className="text-[10px] text-ink-faint">
                {item.sectionTitle}
              </span>
            )}
          </div>

          <blockquote className="mt-3 border-l-2 border-yellow pl-3 text-[12.5px] leading-5 text-ink-soft">
            “{item.text}”
          </blockquote>
        </article>
      ))}
    </div>
  );
}
