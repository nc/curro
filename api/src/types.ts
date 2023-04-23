import { z } from "zod";

export const Message = z.discriminatedUnion("type", [
  z.object({ type: z.literal("eval"), id: z.string(), code: z.string() }),
  z.object({ type: z.literal("token"), id: z.string(), token: z.string() }),
  z.object({ type: z.literal("answer"), id: z.string(), answer: z.string() }),
  z.object({ type: z.literal("error"), error: z.string() }),
  z.object({
    type: z.literal("evalSuccess"),
    id: z.string(),
    result: z.string(),
  }),
  z.object({ type: z.literal("evalError"), id: z.string(), error: z.string() }),
  z.object({
    type: z.literal("question"),
    id: z.string(),
    question: z.string(),
  }),
]);

export type Message = z.infer<typeof Message>;

export type Tool = {
  name: string;
  description: string;
  fn: (
    env: Env,
    id: string,
    onToken: (id: string, token: string) => void,
    evalFn: RemoteEvalRequest,
    input: string
  ) => Promise<string>;
};

export interface Env {
  OPENAI_API_KEY: string;
}

export type Tools = {
  [key: string]: Tool;
};

export type RemoteEvalResult =
  | {
      type: "evalSuccess";
      id: string;
      result: string;
    }
  | {
      type: "evalError";
      id: string;
      error: string;
    };

export type RemoteEvalRequest = (
  id: string,
  code: string
) => Promise<RemoteEvalResult>;
