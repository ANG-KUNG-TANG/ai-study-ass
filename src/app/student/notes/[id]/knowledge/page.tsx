"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams } from "next/navigation";
import { useNoteContext } from "@/context/NoteContext";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Topbar } from "@/components/layout/Topbar";

type KnowledgeStatus =
  | "not_generated"
  | "ready"
  | "partial"
  | "failed";

interface KnowledgeGraphNode {
  id: string;
  type: string;
  label: string;
  properties?: Record<string, unknown>;
}

interface KnowledgeGraphEdge {
  from: string;
  to: string;
  type: string;
  weight: number;
}

interface KnowledgeResponse {
  noteId: string;
  stage: string;
  status: KnowledgeStatus;
  mode: string | null;
  error?: string;

  confidence?: number;

  graph?: {
    nodes: KnowledgeGraphNode[];
    edges: KnowledgeGraphEdge[];
  };

  core?: {
    method?: string | null;
    dataset?: string | null;
    accuracy?: number | null;
    problem?: string | null;
    contributions?: string[];
    entities?: string[];
    keyPoints?: Array<{
      label: string;
      value: string;
    }>;
  };

  ontologyMatches?: unknown[];
  prologFacts?: unknown[];
}

interface KnowledgeItem {
  id: string;
  concept: string;
  description: string;
  type: string;
}

function readableType(type: string): string {
  return type
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

function getNodeDescription(
  node: KnowledgeGraphNode,
): string {
  const properties =
    node.properties ?? {};

  const candidates = [
    properties.description,
    properties.definition,
    properties.summary,
    properties.value,
  ];

  const description = candidates.find(
    (value): value is string =>
      typeof value === "string" &&
      value.trim().length > 0,
  );

  if (description) {
    return description;
  }

  return `${readableType(node.type)} extracted from the uploaded document.`;
}

export default function KnowledgePage() {
  const params =
    useParams<{ id: string }>();

  const noteId = params.id;
  const { note } = useNoteContext();

  const [knowledge, setKnowledge] =
    useState<KnowledgeResponse | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!noteId) {
      return;
    }

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
        }
      } catch (unknownError) {
        if (!cancelled) {
          setError(
            unknownError instanceof Error
              ? unknownError.message
              : "Failed to load knowledge",
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

  const knowledgeItems =
    useMemo<KnowledgeItem[]>(() => {
      const nodes =
        knowledge?.graph?.nodes ?? [];

      return nodes.map((node) => ({
        id: node.id,
        concept:
          node.label || "Unnamed concept",
        description:
          getNodeDescription(node),
        type:
          node.type || "concept",
      }));
    }, [knowledge]);

  if (!note) {
    return (
      <p className="text-[13px] text-[#726B5C]">
        Loading note…
      </p>
    );
  }

  return (
    <>
      <Topbar
        eyebrow="Knowledge"
        title={`Knowledge graph for "${note.title}"`}
      />

      {isLoading && (
        <p className="text-[13px] text-[#726B5C]">
          Loading knowledge…
        </p>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-[13px] text-[#E85D46]">
            {error}
          </p>
        </div>
      )}

      {!isLoading &&
        !error &&
        knowledge?.status ===
          "not_generated" && (
          <div className="rounded-2xl border border-dashed border-[#E6DDC8] bg-white p-8 text-center">
            <p className="text-[13px] font-medium text-[#38342C]">
              Knowledge has not been generated yet.
            </p>

            <p className="mt-2 text-[12px] text-[#726B5C]">
              Run study-material generation for
              this note, then reload this page.
            </p>
          </div>
        )}

      {!isLoading &&
        !error &&
        knowledge?.status === "failed" && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-[13px] font-medium text-[#E85D46]">
              Knowledge processing failed.
            </p>

            {knowledge.error && (
              <p className="mt-2 text-[12px] text-[#726B5C]">
                {knowledge.error}
              </p>
            )}
          </div>
        )}

      {!isLoading &&
        !error &&
        knowledge &&
        knowledge.status !==
          "not_generated" &&
        knowledge.status !== "failed" &&
        knowledgeItems.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#E6DDC8] bg-white p-8 text-center">
            <p className="text-[13px] text-[#726B5C]">
              The analysis completed, but no graph
              concepts were extracted.
            </p>
          </div>
        )}

      {!isLoading &&
        !error &&
        knowledge &&
        knowledgeItems.length > 0 && (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#F4EFE4] px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-[#726B5C]">
                {knowledge.status}
              </span>

              {knowledge.mode && (
                <span className="rounded-full bg-[#F4EFE4] px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-[#726B5C]">
                  {readableType(
                    knowledge.mode,
                  )}
                </span>
              )}

              {typeof knowledge.confidence ===
                "number" && (
                <span className="rounded-full bg-[#F4EFE4] px-3 py-1 text-[11px] font-medium text-[#726B5C]">
                  Confidence:{" "}
                  {Math.round(
                    knowledge.confidence * 100,
                  )}
                  %
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {knowledgeItems.map((item) => (
                <Card
                  key={item.id}
                  className="transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="mb-2">
                    <span className="rounded-full bg-[#F4EFE4] px-2 py-1 text-[10px] uppercase tracking-wide text-[#726B5C]">
                      {readableType(item.type)}
                    </span>
                  </div>

                  <h3 className="font-serif text-[15px] font-semibold">
                    {item.concept}
                  </h3>

                  <p className="mt-2 text-[13px] leading-5 text-[#726B5C]">
                    {item.description}
                  </p>
                </Card>
              ))}
            </div>
          </>
        )}
    </>
  );
}