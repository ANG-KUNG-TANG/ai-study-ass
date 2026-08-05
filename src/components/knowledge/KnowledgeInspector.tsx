"use client";

import { useMemo, useState } from "react";
import { BookOpen, GitBranch, ShieldCheck, X } from "lucide-react";
import type { EvidenceItem, KnowledgeGraphEdge, KnowledgeGraphNode } from "./types";
import {
  extractNodeEvidence,
  formatProperty,
  getNodeDescription,
  nodeColor,
  nodeConfidence,
  readableType,
  relationLabel,
} from "./knowledge-graph.utils";

type InspectorTab = "details" | "connections" | "evidence";

interface KnowledgeInspectorProps {
  node: KnowledgeGraphNode;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  onClose?: () => void;
  compact?: boolean;
}

function propertyEntries(node: KnowledgeGraphNode): Array<[string, unknown]> {
  const hidden = new Set(["evidence", "description", "definition", "summary", "explanation"]);
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
  const [tab, setTab] = useState<InspectorTab>("details");
  const confidence = nodeConfidence(node);
  const evidence = extractNodeEvidence(node);
  const accent = nodeColor(node.type);

  const connections = useMemo(
    () =>
      edges
        .filter((edge) => edge.from === node.id || edge.to === node.id)
        .map((edge) => {
          const otherId = edge.from === node.id ? edge.to : edge.from;
          return {
            edge,
            node: nodes.find((candidate) => candidate.id === otherId) ?? null,
            direction: edge.from === node.id ? "outgoing" : "incoming",
          } as const;
        }),
    [edges, node.id, nodes],
  );

  const tabs: Array<{ id: InspectorTab; label: string; count?: number }> = [
    { id: "details", label: "Details" },
    { id: "connections", label: "Connections", count: connections.length },
    { id: "evidence", label: "Evidence", count: evidence.length },
  ];

  return (
    <aside
      className={[
        "overflow-hidden rounded-2xl border border-[#E6DDC8] bg-white shadow-sm",
        compact ? "max-h-[68vh]" : "sticky top-5 max-h-[calc(100vh-40px)]",
      ].join(" ")}
    >
      <div className="border-b border-[#EFE8D6] px-5 pb-0 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="max-w-[245px] break-words font-serif text-[18px] font-semibold leading-6 text-[#221F1A]">
                {node.label}
              </h2>
              <span
                className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: accent, background: `${accent}18` }}
              >
                {readableType(node.type)}
              </span>
            </div>
          </div>
          {onClose && (
            <button type="button" onClick={onClose}
              className="rounded-lg p-1.5 text-[#726B5C] hover:bg-[#F4EFE4]" aria-label="Close inspector">
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
                  ? "border-[#4D7DF3] text-[#255FD6]"
                  : "border-transparent text-[#726B5C] hover:text-[#221F1A]",
              ].join(" ")}
            >
              {item.label}{typeof item.count === "number" && ` (${item.count})`}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[calc(100vh-180px)] overflow-y-auto p-5">
        {tab === "details" && (
          <div className="space-y-6">
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#726B5C]">Description</h3>
              <p className="mt-2 text-[13px] leading-6 text-[#38342C]">{getNodeDescription(node)}</p>
            </section>

            {typeof confidence === "number" && (
              <section>
                <div className="flex items-center justify-between text-[11px] font-medium text-[#514B40]">
                  <span>Confidence</span><span>{Math.round(confidence * 100)}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EFE8D6]">
                  <div className="h-full rounded-full"
                    style={{ width: `${Math.max(0, Math.min(100, confidence * 100))}%`, background: accent }} />
                </div>
              </section>
            )}

            <section>
              <div className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-[#4C7A5A]" />
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#726B5C]">Properties</h3>
              </div>
              <dl className="mt-3 divide-y divide-[#EFE8D6]">
                <div className="grid grid-cols-[105px_1fr] gap-3 py-2.5 text-[12px]">
                  <dt className="text-[#726B5C]">Type</dt>
                  <dd className="font-medium text-[#38342C]">{readableType(node.type)}</dd>
                </div>
                {propertyEntries(node).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[105px_1fr] gap-3 py-2.5 text-[12px]">
                    <dt className="break-words text-[#726B5C]">{readableType(key)}</dt>
                    <dd className="break-words font-medium text-[#38342C]">{formatProperty(value)}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <button type="button" onClick={() => setTab("connections")}
              className="flex w-full items-center justify-between rounded-xl border border-[#E6DDC8] bg-[#FAF6EC] px-4 py-3 text-left hover:bg-[#F4EFE4]">
              <span className="flex items-center gap-2 text-[12px] font-medium text-[#38342C]">
                <GitBranch size={15} /> Connected concepts
              </span>
              <span className="text-[12px] text-[#726B5C]">{connections.length}</span>
            </button>
          </div>
        )}

        {tab === "connections" && (
          <div className="space-y-3">
            {connections.length === 0 ? (
              <p className="text-[13px] text-[#726B5C]">No direct relationships were found.</p>
            ) : connections.map(({ edge, node: connectedNode, direction }) => (
              <div key={`${edge.from}-${edge.type}-${edge.to}`}
                className="rounded-xl border border-[#E6DDC8] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12.5px] font-semibold text-[#38342C]">
                      {connectedNode?.label ?? "Unknown concept"}
                    </p>
                    <p className="mt-1 text-[11px] text-[#726B5C]">
                      {direction === "outgoing" ? "This node" : connectedNode?.label ?? "Concept"}
                      {" → "}<span className="font-medium">{relationLabel(edge.type)}</span>{" → "}
                      {direction === "outgoing" ? connectedNode?.label ?? "Concept" : "this node"}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#F4EFE4] px-2 py-1 text-[10px] text-[#726B5C]">
                    {Math.round(Math.max(0, Math.min(1, edge.weight)) * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "evidence" && <EvidenceList evidence={evidence} />}
      </div>
    </aside>
  );
}

function EvidenceList({ evidence }: { evidence: EvidenceItem[] }) {
  if (evidence.length === 0) {
    return <p className="text-[13px] text-[#726B5C]">No source evidence is attached to this node.</p>;
  }

  return (
    <div className="space-y-3">
      {evidence.map((item) => (
        <article key={item.id} className="rounded-xl border border-[#E6DDC8] bg-[#FFFCF6] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-[10px] font-medium text-[#726B5C]">
              <BookOpen size={12} />{item.pageNumber ? `Page ${item.pageNumber}` : "Document evidence"}
            </span>
            {item.sectionTitle && <span className="text-[10px] text-[#9B927F]">{item.sectionTitle}</span>}
          </div>
          <blockquote className="mt-3 border-l-2 border-[#FFCE3E] pl-3 text-[12.5px] leading-5 text-[#514B40]">
            “{item.text}”
          </blockquote>
        </article>
      ))}
    </div>
  );
}
