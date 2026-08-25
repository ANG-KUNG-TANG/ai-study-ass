export interface StickyNote {
  id: string;
  content: string;
  sourcePath: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStickyNoteInput {
  content: string;
  sourcePath?: string;
}
