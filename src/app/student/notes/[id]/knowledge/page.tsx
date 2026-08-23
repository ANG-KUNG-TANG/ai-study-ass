"use client";

import {
  BookOpen,
  Brain,
  ChevronRight,
  GitBranch,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { KnowledgeGraphCanvas } from "@/components/knowledge/KnowledgeGraphCanvas";
import { KnowledgeInspector } from "@/components/knowledge/KnowledgeInspector";
import { LearningPath } from "@/components/knowledge/LearningPath";
import {
  collectEvidence,
  getNodeDescription,
  nodeColor,
  nodeConfidence,
  readableType,
  relationLabel,
} from "@/components/knowledge/knowledge-graph.utils";
import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeResponse,
  KnowledgeTab,
} from "@/components/knowledge/types";
import { useNoteContext } from "@/context/NoteContext";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";

const MIN_CONFIDENCE_OPTIONS: ReadonlyArray<{
  value: string;
  labelKey: TranslationKey;
}> = [
  { value: "0", labelKey: "knowledge.allConfidence" },
  { value: "0.5", labelKey: "knowledge.confidence50" },
  { value: "0.7", labelKey: "knowledge.confidence70" },
  { value: "0.85", labelKey: "knowledge.confidence85" },
];

export default function KnowledgePage() {
  const params = useParams<{ id: string }>();
  const noteId = params.id;
  const { note } = useNoteContext();
  const { t } = useLanguage();

  const [knowledge, setKnowledge] =
    useState<KnowledgeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] =
    useState<string | null>(null);
  const [activeTab, setActiveTab] =
    useState<KnowledgeTab>("learn");
  const [search, setSearch] = useState("");
  const [nodeType, setNodeType] =
    useState("all");
  const [relationType, setRelationType] =
    useState("all");
  const [
    minimumConfidence,
    setMinimumConfidence,
  ] = useState(0);
  const [selectedNodeId, setSelectedNodeId] =
    useState<string | null>(null);

  useEffect(() => {
    if (!noteId) return;

    let cancelled = false;

    async function fetchKnowledge() {
      setIsLoading(true);
      setError(null);

      try {
        const data =
          await apiFetch<KnowledgeResponse>(
            `/notes/${encodeURIComponent(
              noteId,
            )}/knowledge`,
          );

        if (!cancelled) {
          setKnowledge(data);

          setSelectedNodeId(
            data.graph?.nodes.find(
              (node) => node.type === "paper",
            )?.id ??
              data.graph?.nodes[0]?.id ??
              null,
          );
        }
      } catch (unknownError) {
        if (!cancelled) {
          setError(
            unknownError instanceof Error
              ? unknownError.message
              : "",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetchKnowledge();

    return () => {
      cancelled = true;
    };
  }, [noteId]);

  const allNodes = useMemo(
    () => knowledge?.graph?.nodes ?? [],
    [knowledge?.graph?.nodes],
  );

  const allEdges = useMemo(
    () => knowledge?.graph?.edges ?? [],
    [knowledge?.graph?.edges],
  );

  const conceptNodes = useMemo(
    () =>
      allNodes.filter(
        (node) =>
          node.type !== "paper" &&
          node.type !== "section",
      ),
    [allNodes],
  );

  const sectionCount = useMemo(
    () =>
      allNodes.filter(
        (node) => node.type === "section",
      ).length,
    [allNodes],
  );

  const nodeTypes = useMemo(
    () =>
      [
        ...new Set(
          allNodes
            .map((node) => node.type)
            .filter(Boolean),
        ),
      ].sort(),
    [allNodes],
  );

  const relationTypes = useMemo(
    () =>
      [
        ...new Set(
          allEdges
            .map((edge) => edge.type)
            .filter(Boolean),
        ),
      ].sort(),
    [allEdges],
  );

  const filteredGraph = useMemo(
    () =>
      filterGraph({
        nodes: allNodes,
        edges: allEdges,
        search,
        nodeType,
        relationType,
        minimumConfidence,
      }),
    [
      allEdges,
      allNodes,
      minimumConfidence,
      nodeType,
      relationType,
      search,
    ],
  );

  const evidence = useMemo(
    () => collectEvidence(allNodes),
    [allNodes],
  );

  const selectedNode =
    allNodes.find(
      (node) => node.id === selectedNodeId,
    ) ?? null;

  const averageConfidence = useMemo(() => {
    const values = conceptNodes
      .map(nodeConfidence)
      .filter(
        (value): value is number =>
          typeof value === "number",
      );

    if (values.length === 0) {
      return knowledge?.confidence ?? null;
    }

    return (
      values.reduce(
        (sum, value) => sum + value,
        0,
      ) / values.length
    );
  }, [conceptNodes, knowledge?.confidence]);

  function openConcept(nodeId: string) {
    setSelectedNodeId(nodeId);
    setActiveTab("graph");
  }

  if (!note) {
    return (
      <p className="text-[13px] text-[#726B5C]">
        {t("note.loading")}
      </p>
    );
  }

  return (
    <div className="pb-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-[#E85D46]">
            {t("knowledge.eyebrow")}
          </div>

          <h1 className="font-serif text-[28px] font-semibold text-[#221F1A]">
            {t("knowledge.title")}
          </h1>

          <p className="mt-2 max-w-[680px] text-[13px] leading-5 text-[#726B5C]">
            {t("knowledge.description", { title: note.title })}
          </p>

          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#CFE3D3] bg-[#F2F8F3] px-3 py-1.5 text-[10.5px] font-medium text-[#4C7A5A]">
            <ShieldCheck size={13} />
            {t("knowledge.grounded")}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <MetricCard
            icon={BookOpen}
            value={sectionCount || "—"}
            label={t("knowledge.sections")}
          />
          <MetricCard
            icon={Brain}
            value={conceptNodes.length}
            label={t("knowledge.items")}
          />
          <MetricCard
            icon={ShieldCheck}
            value={
              averageConfidence === null
                ? "—"
                : `${Math.round(
                    averageConfidence * 100,
                  )}%`
            }
            label={t("knowledge.grounding")}
          />
        </div>
      </header>

      {isLoading && <LoadingState />}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-[13px] font-medium text-[#E85D46]">
            {t("knowledge.loadFailed")}
          </p>
          <p className="mt-2 text-[12px] text-[#726B5C]">
            {error || t("knowledge.loadFailed")}
          </p>
        </div>
      )}

      {!isLoading &&
        !error &&
        knowledge?.status === "not_generated" && (
          <EmptyState
            title={t("knowledge.notGenerated")}
            description={t("knowledge.notGeneratedDescription")}
          />
        )}

      {!isLoading &&
        !error &&
        knowledge?.status === "failed" && (
          <EmptyState
            title={t("knowledge.processingFailed")}
            description={
              knowledge.error ??
              t("knowledge.pipelineFailed")
            }
            danger
          />
        )}

      {!isLoading &&
        !error &&
        knowledge &&
        knowledge.status !== "not_generated" &&
        knowledge.status !== "failed" && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex flex-wrap rounded-xl border border-[#E6DDC8] bg-white p-1">
                <TabButton
                  active={activeTab === "learn"}
                  label={t("knowledge.learningPath")}
                  count={sectionCount}
                  onClick={() =>
                    setActiveTab("learn")
                  }
                />

                <TabButton
                  active={activeTab === "graph"}
                  label={t("knowledge.conceptMap")}
                  count={conceptNodes.length}
                  onClick={() =>
                    setActiveTab("graph")
                  }
                />

                <TabButton
                  active={activeTab === "concepts"}
                  label={t("knowledge.concepts")}
                  count={conceptNodes.length}
                  onClick={() =>
                    setActiveTab("concepts")
                  }
                />

                <TabButton
                  active={activeTab === "evidence"}
                  label={t("knowledge.evidence")}
                  count={evidence.length}
                  onClick={() =>
                    setActiveTab("evidence")
                  }
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusPill
                  label={knowledge.status}
                />
                {knowledge.mode && (
                  <StatusPill
                    label={readableType(
                      knowledge.mode,
                    )}
                  />
                )}
              </div>
            </div>

            {activeTab === "learn" && (
              <LearningPath
                nodes={allNodes}
                edges={allEdges}
                onOpen={openConcept}
              />
            )}

            {activeTab === "graph" && (
              <>
                <GraphFilters
                  search={search}
                  nodeType={nodeType}
                  relationType={relationType}
                  minimumConfidence={
                    minimumConfidence
                  }
                  nodeTypes={nodeTypes}
                  relationTypes={relationTypes}
                  onSearch={setSearch}
                  onNodeType={setNodeType}
                  onRelationType={
                    setRelationType
                  }
                  onMinimumConfidence={
                    setMinimumConfidence
                  }
                />

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <KnowledgeGraphCanvas
                    nodes={
                      filteredGraph.nodes
                    }
                    edges={
                      filteredGraph.edges
                    }
                    selectedNodeId={
                      selectedNodeId
                    }
                    onSelectNode={
                      setSelectedNodeId
                    }
                  />

                  <div className="hidden xl:block">
                    {selectedNode ? (
                      <KnowledgeInspector
                        node={selectedNode}
                        nodes={allNodes}
                        edges={allEdges}
                        onClose={() =>
                          setSelectedNodeId(
                            null,
                          )
                        }
                      />
                    ) : (
                      <InspectorPlaceholder />
                    )}
                  </div>
                </div>

                {selectedNode && (
                  <div className="fixed inset-x-3 bottom-3 z-50 xl:hidden">
                    <KnowledgeInspector
                      node={selectedNode}
                      nodes={allNodes}
                      edges={allEdges}
                      onClose={() =>
                        setSelectedNodeId(null)
                      }
                      compact
                    />
                  </div>
                )}

                <GraphLegend
                  nodeTypes={nodeTypes}
                  relationTypes={
                    relationTypes
                  }
                />
              </>
            )}

            {activeTab === "concepts" && (
              <ConceptGrid
                nodes={conceptNodes}
                onOpen={openConcept}
              />
            )}

            {activeTab === "evidence" && (
              <EvidenceGrid
                evidence={evidence}
              />
            )}
          </>
        )}
    </div>
  );
}

function filterGraph({
  nodes,
  edges,
  search,
  nodeType,
  relationType,
  minimumConfidence,
}: {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  search: string;
  nodeType: string;
  relationType: string;
  minimumConfidence: number;
}): {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
} {
  const query = search
    .trim()
    .toLowerCase();

  const matchingNodes = nodes.filter(
    (node) => {
      const confidence =
        nodeConfidence(node);

      const passesConfidence =
        node.type === "paper" ||
        node.type === "section" ||
        confidence === undefined ||
        confidence >=
          minimumConfidence;

      const passesType =
        nodeType === "all" ||
        node.type === nodeType;

      const searchable =
        `${node.label} ${node.type} ${getNodeDescription(
          node,
        )}`.toLowerCase();

      const passesSearch =
        !query ||
        searchable.includes(query);

      return (
        passesConfidence &&
        passesType &&
        passesSearch
      );
    },
  );

  const visibleIds = new Set(
    matchingNodes.map((node) => node.id),
  );

  if (query && matchingNodes.length > 0) {
    for (const edge of edges) {
      if (visibleIds.has(edge.from)) {
        visibleIds.add(edge.to);
      }

      if (visibleIds.has(edge.to)) {
        visibleIds.add(edge.from);
      }
    }
  }

  const visibleNodes = nodes.filter(
    (node) => visibleIds.has(node.id),
  );

  const visibleEdges = edges.filter(
    (edge) =>
      visibleIds.has(edge.from) &&
      visibleIds.has(edge.to) &&
      (relationType === "all" ||
        edge.type === relationType),
  );

  return {
    nodes: visibleNodes,
    edges: visibleEdges,
  };
}

function GraphFilters({
  search,
  nodeType,
  relationType,
  minimumConfidence,
  nodeTypes,
  relationTypes,
  onSearch,
  onNodeType,
  onRelationType,
  onMinimumConfidence,
}: {
  search: string;
  nodeType: string;
  relationType: string;
  minimumConfidence: number;
  nodeTypes: string[];
  relationTypes: string[];
  onSearch: (value: string) => void;
  onNodeType: (value: string) => void;
  onRelationType: (value: string) => void;
  onMinimumConfidence: (
    value: number,
  ) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[#E6DDC8] bg-white p-3">
      <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-[#E6DDC8] bg-[#FFFCF6] px-3 py-2.5">
        <Search
          size={15}
          className="shrink-0 text-[#9B927F]"
        />

        <input
          type="search"
          value={search}
          onChange={(event) =>
            onSearch(event.target.value)
          }
          placeholder={t("knowledge.search")}
          className="w-full bg-transparent text-[12.5px] text-[#38342C] outline-none placeholder:text-[#B3A98F]"
        />
      </div>

      <FilterSelect
        value={nodeType}
        onChange={onNodeType}
        label={t("knowledge.type")}
      >
        <option value="all">
          {t("knowledge.allTypes")}
        </option>

        {nodeTypes.map((type) => (
          <option
            key={type}
            value={type}
          >
            {readableType(type)}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        value={relationType}
        onChange={onRelationType}
        label={t("knowledge.relationship")}
      >
        <option value="all">
          {t("knowledge.allRelationships")}
        </option>

        {relationTypes.map((type) => (
          <option
            key={type}
            value={type}
          >
            {relationLabel(type)}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        value={String(
          minimumConfidence,
        )}
        onChange={(value) =>
          onMinimumConfidence(
            Number(value),
          )
        }
        label={t("knowledge.minimumConfidence")}
      >
        {MIN_CONFIDENCE_OPTIONS.map(
          (option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {t(option.labelKey)}
            </option>
          ),
        )}
      </FilterSelect>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="relative">
      <span className="sr-only">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="h-[42px] min-w-[155px] appearance-none rounded-xl border border-[#E6DDC8] bg-[#FFFCF6] py-2 pl-3 pr-9 text-[12px] font-medium text-[#514B40] outline-none focus:border-[#4D7DF3]"
      >
        {children}
      </select>

      <SlidersHorizontal
        size={13}
        className="pointer-events-none absolute right-3 top-3.5 text-[#9B927F]"
      />
    </label>
  );
}

function MetricCard({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Brain;
  value: number | string;
  label: string;
}) {
  return (
    <div className="min-w-[105px] rounded-2xl border border-[#E6DDC8] bg-white px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#4D7DF3]">
          <Icon size={15} />
        </div>

        <div>
          <p className="text-[16px] font-semibold leading-5 text-[#221F1A]">
            {value}
          </p>

          <p className="text-[9.5px] text-[#726B5C]">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg px-3.5 py-2 text-[12px] font-medium transition",
        active
          ? "bg-[#EEF4FF] text-[#255FD6]"
          : "text-[#726B5C] hover:bg-[#F4EFE4]",
      ].join(" ")}
    >
      {label}{" "}
      <span className="opacity-65">
        ({count})
      </span>
    </button>
  );
}

function StatusPill({
  label,
}: {
  label: string;
}) {
  return (
    <span className="rounded-full border border-[#E6DDC8] bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#726B5C]">
      {readableType(label)}
    </span>
  );
}

function ConceptGrid({
  nodes,
  onOpen,
}: {
  nodes: KnowledgeGraphNode[];
  onOpen: (nodeId: string) => void;
}) {
  const { t } = useLanguage();

  if (nodes.length === 0) {
    return (
      <EmptyState
        title={t("knowledge.noConcepts")}
        description={t("knowledge.noConceptsDescription")}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {nodes.map((node) => {
        const confidence =
          nodeConfidence(node);
        const accent = nodeColor(
          node.type,
        );

        return (
          <Card
            key={node.id}
            className="group cursor-pointer transition hover:-translate-y-1 hover:shadow-lg"
            onClick={() =>
              onOpen(node.id)
            }
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  color: accent,
                  background: `${accent}18`,
                }}
              >
                {readableType(node.type)}
              </span>

              <ChevronRight
                size={16}
                className="text-[#B3A98F] transition group-hover:translate-x-0.5 group-hover:text-[#4D7DF3]"
              />
            </div>

            <h3 className="mt-3 font-serif text-[16px] font-semibold leading-6 text-[#221F1A]">
              {node.label}
            </h3>

            <p className="mt-2 max-h-[66px] overflow-hidden text-[12.5px] leading-[22px] text-[#726B5C]">
              {getNodeDescription(node)}
            </p>

            {typeof confidence ===
              "number" && (
              <div className="mt-4">
                <div className="flex justify-between text-[10px] text-[#726B5C]">
                  <span>
                    {t("knowledge.sourceConfidence")}
                  </span>
                  <span>
                    {Math.round(
                      confidence * 100,
                    )}
                    %
                  </span>
                </div>

                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EFE8D6]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${
                        confidence * 100
                      }%`,
                      background: accent,
                    }}
                  />
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function EvidenceGrid({
  evidence,
}: {
  evidence: ReturnType<
    typeof collectEvidence
  >;
}) {
  const { t } = useLanguage();

  if (evidence.length === 0) {
    return (
      <EmptyState
        title={t("knowledge.noEvidence")}
        description={t("knowledge.noEvidenceDescription")}
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {evidence.map((item) => (
        <article
          key={item.id}
          className="rounded-2xl border border-[#E6DDC8] bg-white p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F4EFE4] px-2.5 py-1 text-[10px] font-medium text-[#726B5C]">
              <BookOpen size={12} />
              {item.pageNumber
                ? t("knowledge.page", { page: item.pageNumber })
                : t("knowledge.sourceEvidence")}
            </span>

            <span className="rounded-full bg-[#EEF4FF] px-2 py-1 text-[10px] font-medium text-[#255FD6]">
              {readableType(
                item.nodeType,
              )}
            </span>
          </div>

          <blockquote className="mt-4 border-l-2 border-[#FFCE3E] pl-4 text-[13px] leading-6 text-[#514B40]">
            “{item.text}”
          </blockquote>

          <p className="mt-4 text-[11px] font-medium text-[#726B5C]">
            {t("knowledge.supports")} {" "}
            <span className="text-[#38342C]">
              {item.nodeLabel}
            </span>
          </p>
        </article>
      ))}
    </div>
  );
}

function GraphLegend({
  nodeTypes,
  relationTypes,
}: {
  nodeTypes: string[];
  relationTypes: string[];
}) {
  const { t } = useLanguage();

  return (
    <div className="mt-4 rounded-2xl border border-[#E6DDC8] bg-white p-4">
      <div className="flex flex-wrap gap-x-5 gap-y-3">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#726B5C]">
          {t("knowledge.types")}
        </span>

        {nodeTypes.map((type) => (
          <span
            key={type}
            className="inline-flex items-center gap-1.5 text-[10.5px] text-[#514B40]"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background:
                  nodeColor(type),
              }}
            />
            {readableType(type)}
          </span>
        ))}
      </div>

      {relationTypes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3 border-t border-[#EFE8D6] pt-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#726B5C]">
            {t("knowledge.relationships")}
          </span>

          {relationTypes
            .slice(0, 10)
            .map((type) => (
              <span
                key={type}
                className="text-[10.5px] text-[#514B40]"
              >
                {relationLabel(type)}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

function InspectorPlaceholder() {
  const { t } = useLanguage();

  return (
    <div className="sticky top-5 flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-[#E6DDC8] bg-white p-8 text-center">
      <div>
        <GitBranch
          size={28}
          className="mx-auto text-[#B3A98F]"
        />

        <p className="mt-3 text-[13px] font-medium text-[#38342C]">
          {t("knowledge.selectItem")}
        </p>

        <p className="mt-2 text-[12px] leading-5 text-[#726B5C]">
          {t("knowledge.selectDescription")}
        </p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="h-[640px] animate-pulse rounded-2xl border border-[#E6DDC8] bg-white/70" />
      <div className="hidden h-[520px] animate-pulse rounded-2xl border border-[#E6DDC8] bg-white/70 xl:block" />
    </div>
  );
}

function EmptyState({
  title,
  description,
  danger = false,
}: {
  title: string;
  description: string;
  danger?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border border-dashed bg-white p-10 text-center",
        danger
          ? "border-red-200"
          : "border-[#E6DDC8]",
      ].join(" ")}
    >
      <p
        className={[
          "text-[13px] font-semibold",
          danger
            ? "text-[#E85D46]"
            : "text-[#38342C]",
        ].join(" ")}
      >
        {title}
      </p>

      <p className="mx-auto mt-2 max-w-[520px] text-[12px] leading-5 text-[#726B5C]">
        {description}
      </p>
    </div>
  );
}
