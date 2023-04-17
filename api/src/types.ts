export type Tool = {
  name: string;
  description: string;
  fn: (env: Env, evalFn: RemoteEvalReqest, input: string) => Promise<string>;
};

export interface Env {
  OPENAI_API_KEY: string;
}

export type Tools = {
  [key: string]: Tool;
};

export type RemoveEvalResult =
  | {
      status: "success";
      result: string;
      id: string;
    }
  | {
      status: "error";
      error: string;
      id: string;
    };

export type Message =
  | {
      type: "eval";
      code: string;
      id: string;
    }
  | {
      type: "token";
      token: string;
    }
  | {
      type: "answer";
      answer: string;
    }
  | {
      type: "error";
      error: string;
    }
  | {
      type: "question";
      question: string;
    };

export type RemoteEvalReqest = (code: string) => Promise<RemoveEvalResult>;
