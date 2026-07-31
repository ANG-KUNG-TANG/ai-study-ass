import { AlignLeft, HelpCircle, Copy, MessageCircle, Network, MessageSquare } from "lucide-react";

export function noteTabItems(noteId: string) {
    return [
        { href: `/student/notes/${noteId}`, label: "Summary", icon: AlignLeft},
        { href: `/student/notes/${noteId}/quiz`, label: "Quiz", icon: HelpCircle},
        { href: `/student/notes/${noteId}/flashcard`, label: "Flashcards", icon: Copy},
        { href: `/student/notes/${noteId}/chat`, label: 'Chat', icon: MessageSquare},
        { href: `/student/notes/${noteId}/knowledge`, label: 'Knowledge', icon: Network}
        ]
}