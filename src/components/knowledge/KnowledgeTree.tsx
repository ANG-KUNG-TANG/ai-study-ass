"use client";

import {
  Brain,
  ChevronRight,
  FileText,
  Layers3,
  Tag,
} from "lucide-react";
import type {
  KnowledgeTreeData,
  KnowledgeTreeNode,
} from "./types";
import { useLanguage } from "@/context/LanguageContext";

interface KnowledgeTreeProps {
  tree: KnowledgeTreeData | null | undefined;
  onOpen: (nodeId: string) => void;
}

export function KnowledgeTree({
  tree,
  onOpen,
}: KnowledgeTreeProps) {
  const { t } = useLanguage();

  if (
    !tree?.root ||
    tree.root.children.length === 0
  ) {
    return (
      <div className="rounded-[10px] border border-line bg-paper-raised p-5">
        <h2 className="font-serif text-[18px] font-semibold text-ink">
          {t("knowledge.noConcepts")}
        </h2>
        <p className="mt-1 text-[12px] leading-5 text-ink-soft">
          {t("knowledge.noConceptsDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[10px] border border-violet/25 bg-violet-soft/45 p-4">
        <div className="flex items-start gap-3">
          <Brain
            size={18}
            className="mt-0.5 shrink-0 text-violet"
          />
          <div>
            <p className="text-[13px] font-semibold text-violet">
              {t("knowledge.grounded")}
            </p>
            <p className="mt-1 text-[12px] leading-5 text-slate">
              {t("knowledge.selectDescription")}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[10px] border border-line bg-paper-raised p-4 sm:p-5">
        <TreeBranch
          node={tree.root}
          depth={0}
          onOpen={onOpen}
        />
      </div>
    </div>
  );
}

function TreeBranch({
  node,
  depth,
  onOpen,
}: {
  node: KnowledgeTreeNode;
  depth: number;
  onOpen: (nodeId: string) => void;
}) {
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={[
          "flex items-start gap-2.5 rounded-[8px] px-2.5 py-2",
          depth === 0
            ? "bg-violet-soft/35"
            : "hover:bg-line-soft/60",
        ].join(" ")}
      >
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line bg-paper">
          <NodeIcon type={node.type} />
        </div>

        <div className="min-w-0 flex-1">
          {node.graphNodeId ? (
            <button
              type="button"
              onClick={() => {
                if (node.graphNodeId) {
                  onOpen(node.graphNodeId);
                }
              }}
              className="group flex max-w-full items-start gap-1.5 text-left"
            >
              <span className="break-words text-[12.5px] font-semibold leading-5 text-ink group-hover:text-violet">
                {node.label}
              </span>
              {depth > 0 && (
                <ChevronRight
                  size={13}
                  className="mt-1 shrink-0 text-ink-faint"
                />
              )}
            </button>
          ) : (
            <p className="break-words text-[12.5px] font-semibold leading-5 text-ink">
              {node.label}
            </p>
          )}

          {node.description && depth > 0 && (
            <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-5 text-ink-soft">
              {node.description}
            </p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-line-soft px-2 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.05em] text-ink-faint">
              {node.type}
            </span>

          </div>
        </div>
      </div>

      {hasChildren && (
        <div
          className="ml-5 border-l border-line pl-3"
          aria-label={`${node.label} children`}
        >
          {node.children.map((child) => (
            <TreeBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NodeIcon({
  type,
}: {
  type: KnowledgeTreeNode["type"];
}) {
  const className = "text-ink-soft";

  switch (type) {
    case "root":
      return (
        <Brain
          size={13}
          className={className}
        />
      );
    case "topic":
      return (
        <Layers3
          size={13}
          className={className}
        />
      );
    case "term":
      return (
        <Tag
          size={13}
          className={className}
        />
      );
    case "fact":
      return (
        <FileText
          size={13}
          className={className}
        />
      );
    case "concept":
      return (
        <Brain
          size={13}
          className={className}
        />
      );
  }
}
