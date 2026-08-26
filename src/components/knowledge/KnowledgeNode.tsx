"use client";

import { memo } from "react";
import {
  Brain,
  CircleDot,
  Database,
  FileText,
  Gauge,
  Layers3,
  Lightbulb,
  Trophy,
  Users,
  Wrench,
} from "lucide-react";
import {
  Handle,
  Position,
  type NodeProps,
} from "@xyflow/react";
import type { KnowledgeFlowNode } from "./types";
import {
  nodeColor,
  readableType,
} from "./knowledge-graph.utils";
import { useLanguage } from "@/context/LanguageContext";

function renderNodeTypeIcon(type: string) {
  const iconProps = {
    size: 17,
    strokeWidth: 1.9,
  };

  switch (type) {
    case "paper":
      return <FileText {...iconProps} />;
    case "section":
      return <Layers3 {...iconProps} />;
    case "concept":
      return <Brain {...iconProps} />;
    case "method":
      return <Wrench {...iconProps} />;
    case "tool":
      return <CircleDot {...iconProps} />;
    case "dataset":
      return <Database {...iconProps} />;
    case "result":
      return <Trophy {...iconProps} />;
    case "metric":
      return <Gauge {...iconProps} />;
    case "sample":
      return <Users {...iconProps} />;
    default:
      return <Lightbulb {...iconProps} />;
  }
}

function backgroundForType(type: string): string {
  switch (type) {
    case "paper":
      return "#DEE9F2";
    case "section":
      return "#FFF1C2";
    case "concept":
      return "#E7E4F5";
    case "method":
      return "#FFF1C2";
    case "tool":
      return "#DEE9F2";
    case "dataset":
      return "#FBE1DB";
    case "result":
      return "#DCEBDF";
    case "metric":
      return "#E7E4F5";
    case "sample":
      return "#DCEBDF";
    case "claim":
      return "#FBE1DB";
    default:
      return "#FAF6EC";
  }
}

function KnowledgeNodeComponent({
  data,
  selected,
}: NodeProps<KnowledgeFlowNode>) {
  const { t } = useLanguage();
  const accent = nodeColor(data.nodeType);
  const confidence =
    typeof data.confidence === "number"
      ? Math.round(data.confidence * 100)
      : null;

  return (
    <div
      className={[
        "relative w-[228px] rounded-[10px] border bg-paper-raised px-4 py-3 transition duration-150",
        selected ? "ring-2 ring-yellow" : "",
        data.dimmed ? "opacity-25" : "opacity-100",
      ].join(" ")}
      style={{
        borderColor: selected
          ? accent
          : `${accent}70`,
        background: backgroundForType(
          data.nodeType,
        ),
      }}
    >
      <Handle
        id="target-left"
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-2 !border-white"
        style={{ background: accent }}
      />

      <Handle
        id="target-top"
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-2 !border-white"
        style={{ background: accent }}
      />

      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-paper-raised"
          style={{ color: accent }}
        >
          {renderNodeTypeIcon(data.nodeType)}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="max-h-10 overflow-hidden text-[12.5px] font-semibold leading-5 text-ink"
            title={data.label}
          >
            {data.label}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-soft">
            <span>
              {data.nodeType === "section"
                ? t("knowledge.learningSection")
                : readableType(data.nodeType)}
            </span>

            {confidence !== null &&
              data.nodeType !== "section" && (
                <>
                  <span>•</span>
                  <span>{confidence}%</span>
                </>
              )}

            {data.connectionCount > 0 && (
              <>
                <span>•</span>
                <span>
                  {data.connectionCount}{" "}
                  {data.connectionCount === 1
                    ? t("knowledge.link")
                    : t("knowledge.links")}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <Handle
        id="source-right"
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-2 !border-white"
        style={{ background: accent }}
      />

      <Handle
        id="source-bottom"
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-2 !border-white"
        style={{ background: accent }}
      />
    </div>
  );
}

export const KnowledgeNode = memo(
  KnowledgeNodeComponent,
);
