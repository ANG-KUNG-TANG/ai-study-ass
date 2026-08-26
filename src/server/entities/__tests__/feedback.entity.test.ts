import { FeedbackEntity } from "@/server/entities/feedback.entity";

describe("FeedbackEntity", () => {
  it("creates a new submission with safe defaults", () => {
    const feedback = FeedbackEntity.create({
      userId: "user-1",
      userEmail: "STUDENT@example.com",
      type: "feature_request",
      title: "Add study reminders",
      message: "Please let me schedule a reminder for each saved note.",
      rating: 4,
      sourcePath: "/student/notes",
    });

    expect(feedback.toUserView()).toMatchObject({
      type: "feature_request",
      title: "Add study reminders",
      rating: 4,
      status: "new",
      sourcePath: "/student/notes",
    });
    expect(feedback.toAdminView().userEmail).toBe("student@example.com");
  });

  it("does not expose administrative review data to the user view", () => {
    const feedback = FeedbackEntity.fromPersistence({
      id: "feedback-1",
      userId: "user-1",
      userEmail: "student@example.com",
      type: "suggestion",
      title: "Improve the quiz flow",
      message: "Keep the selected answer visible after moving forward.",
      rating: null,
      sourcePath: "/student/quiz",
      status: "reviewing",
      adminNote: "Consider for the next release",
      reviewedBy: "admin-1",
      reviewedAt: new Date("2026-08-26T12:00:00Z"),
      createdAt: new Date("2026-08-26T10:00:00Z"),
      updatedAt: new Date("2026-08-26T12:00:00Z"),
    });

    expect(feedback.toUserView()).not.toHaveProperty("adminNote");
    expect(feedback.toUserView()).not.toHaveProperty("reviewedBy");
  });

  it("rejects invalid ratings and short messages", () => {
    expect(() => FeedbackEntity.create({
      userId: "user-1",
      userEmail: "student@example.com",
      type: "general",
      title: "Good app",
      message: "Too short",
      rating: 6,
    })).toThrow("Validation failed");
  });
});
