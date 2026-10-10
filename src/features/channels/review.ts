// A student's review of a class that has ended (web ReviewSheet): stars, an honest comment, and, only if something went wrong, a report about the instructor.
export type ReviewInput = { rating: number; comment: string; report: boolean; why: string };
export const MAX_COMMENT = 2000, MAX_WHY = 1000, MIN_WHY = 10;

/** The message to show, or null when the review can be sent. Same wording as the web. */
export function validateReview(i: ReviewInput): string | null {
  if (!i.rating) return "Choose a rating from 1 to 5 stars.";
  if (i.report && i.why.trim().length < MIN_WHY) return "Tell us what happened (at least 10 characters) so an admin can look into it.";
  return null;
}
export const reviewArgs = (sessionId: string, i: ReviewInput) => ({
  p_session_id: sessionId, p_rating: i.rating, p_comment: i.comment.trim() || null, p_report: i.report, p_report_reason: i.report ? i.why.trim() : null,
});
export type ReviewTarget = { session_id: string; course_title: string; lesson_title?: string | null; instructor_first_name?: string | null };
