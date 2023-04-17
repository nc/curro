/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
  // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
  // MY_KV_NAMESPACE: KVNamespace;
  //
  // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
  // MY_DURABLE_OBJECT: DurableObjectNamespace;
  //
  // Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
  // MY_BUCKET: R2Bucket;
  //
  // Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
  // MY_SERVICE: Fetcher;

  OPENAI_API_KEY: string;
}

import { nanoid } from "nanoid";
import { TOOLS, agent } from "./agent";
import { Message, RemoveEvalResult } from "./types";

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const [client, worker] = Object.values(new WebSocketPair());
    worker.accept();

    // executes a remote eval in the clients browser
    // and returns the result to the worker
    async function remoteEvalFn(code: string): Promise<RemoveEvalResult> {
      const id = nanoid();
      let resolved = false;
      return new Promise((resolve, reject) => {
        worker.send(JSON.stringify({ type: "eval", code, id }));
        worker.addEventListener("message", (event) => {
          setTimeout(() => {
            if (!resolved) {
              reject("timeout");
            }
          }, 10000);
          if (typeof event.data === "string") {
            const response = JSON.parse(event.data);
            if (response.type === "eval" && response.id === id) {
              resolved = true;
              if (response.status === "error") {
                reject(response.error);
              } else {
                console.log("exec: ", response.result);
                resolve(response);
              }
              resolve(response);
            }
          }
        });
      });
    }

    function handleMessage(event: MessageEvent) {
      if (typeof event.data === "string") {
        const message: Message = JSON.parse(event.data);
        if (message.type === "question") {
          agent(env, remoteEvalFn, TOOLS, message.question, "", 0, (token) => {
            worker.send(JSON.stringify({ type: "token", token }));
          }).then((answer) => {
            worker.send(JSON.stringify({ type: "answer", answer }));
          });
        } else if (message.type === "eval") {
          // no-op
        } else {
          console.log("unsupported message type", message);
        }
      }
    }

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("close", () => {
      worker.removeEventListener("message", handleMessage);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  },
};
