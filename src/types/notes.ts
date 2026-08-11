export type NoteFileType = "pdf" | "docx";

export interface Note {
  id: string;
  userId: string;
  title: string;
  fileName: string;
  fileType: NoteFileType;
  fileSize: number;
  content: string;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoteListItem {
  id: string;
  userId: string;
  title: string;
  fileName: string;
  fileType: NoteFileType;
  fileSize: number;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoteListParams {
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "title";
  fileType?: NoteFileType;
  search?: string;
}