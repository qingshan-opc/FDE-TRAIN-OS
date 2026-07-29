export type CoachChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations?: { title?: string; id?: string }[];
  streaming?: boolean;
};
