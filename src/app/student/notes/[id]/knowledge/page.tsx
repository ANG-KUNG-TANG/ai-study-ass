"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useNoteContext } from "@/context/NoteContext";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Topbar } from "@/components/layout/Topbar";
import { Chip } from "@/components/ui/Chip";

interface KnowledgeItem {
  id: string;
  concept: string;
  description: string;
  // adjust based on your actual Knowledge entity fields
}

export default function KnowledgePage() {
  const params = useParams<{ id: string }>();
  const noteId = params.id;
  const { note } = useNoteContext();
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!noteId) return;
    async function fetchKnowledge() {
      try {
        const data = await apiFetch<KnowledgeItem[]>(`/notes/${noteId}/knowledge`);
        setKnowledge(data);
      } catch (err: any) {
        setError(err.message || "Failed to load knowledge");
      } finally {
        setIsLoading(false);
      }
    }
    fetchKnowledge();
  }, [noteId]);

  if (!note) return <p className="text-[13px] text-[#726B5C]">Loading note…</p>;

  return (
    <>
      <Topbar
        eyebrow="Knowledge"
        title={`Knowledge graph for "${note.title}"`}
      />
      {isLoading && <p className="text-[13px] text-[#726B5C]">Loading knowledge…</p>}
      {error && <p className="text-[13px] text-[#E85D46]">{error}</p>}
      {!isLoading && !error && knowledge.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#E6DDC8] bg-white p-8 text-center">
          <p className="text-[13px] text-[#726B5C]">No knowledge items found for this note.</p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {knowledge.map((item) => (
          <Card key={item.id} className="transition hover:-translate-y-1 hover:shadow-lg">
            <h3 className="font-serif text-[15px] font-semibold">{item.concept}</h3>
            <p className="mt-1 text-[13px] text-[#726B5C]">{item.description}</p>
          </Card>
        ))}
      </div>
    </>
  );
}