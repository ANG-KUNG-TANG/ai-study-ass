/**
 * Uploads are streamed into note.service.ts and are not persisted separately.
 * This marker prevents accidental creation of a second upload data store.
 */
export const UPLOADS_ARE_NOTE_BACKED = true as const;
