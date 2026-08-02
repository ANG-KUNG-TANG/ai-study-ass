/**
 * Canonical plural route:
 * /student/notes/[id]/flashcards
 *
 * The existing implementation remains in the legacy singular route so old
 * bookmarks keep working. Both URLs render the same page component.
 */
export { default } from "../flashcard/page";
