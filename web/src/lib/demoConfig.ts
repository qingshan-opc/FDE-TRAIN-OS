/** Demo / dev defaults — override via Vite env in local builds. */

export const DEMO_LEARNER = {
  email: import.meta.env.VITE_LEARNER_EMAIL ?? import.meta.env.VITE_DEMO_EMAIL ?? "learner@fde.local",
  password: import.meta.env.VITE_LEARNER_PASSWORD ?? import.meta.env.VITE_DEMO_PASSWORD ?? "learner1234",
  campId: import.meta.env.VITE_DEFAULT_CAMP_ID ?? "camp-v03",
} as const;

export const DEMO_AUTHOR = {
  email: import.meta.env.VITE_AUTHOR_EMAIL ?? "author@fde.local",
  password: import.meta.env.VITE_AUTHOR_PASSWORD ?? "author1234",
  campId: DEMO_LEARNER.campId,
} as const;

export const DEMO_PARTNER = {
  email: import.meta.env.VITE_PARTNER_DEMO_EMAIL ?? "partner@fde.local",
  password: import.meta.env.VITE_PARTNER_DEMO_PASSWORD ?? "partner1234",
} as const;
