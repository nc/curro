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

import { TOOLS, agent } from "./agent";
import { RemoteEvalResult, Message } from "./types";

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
    async function remoteEvalFn(
      id: string,
      js: string
    ): Promise<RemoteEvalResult> {
      console.debug("[exec]", js);
      let resolved = false;
      return new Promise((resolve, reject) => {
        worker.send(
          JSON.stringify(Message.parse({ type: "eval", code: js, id }))
        );
        worker.addEventListener("message", (event) => {
          setTimeout(() => {
            if (!resolved) {
              reject("timeout");
            }
          }, 10000);
          if (typeof event.data === "string") {
            const response = Message.parse(JSON.parse(event.data));
            if (response.type === "evalSuccess" && response.id === id) {
              resolved = true;
              console.log("[exec result]", response.result);
              resolve(response);
            } else {
              resolved = true;
              console.error("[exec error]", response);
              reject(response);
            }
          }
        });
      });
    }

    function handleMessage(event: MessageEvent) {
      console.debug("[message]", event.data);
      if (typeof event.data === "string") {
        const message = Message.parse(JSON.parse(event.data));
        switch (message.type) {
          case "question":
            console.debug("[question]", message.question);
            agent(
              env,
              message.id,
              remoteEvalFn,
              TOOLS,
              message.question,
              "Thought: ",
              0,
              (id, token) => {
                // console.debug("[token]", token);
                worker.send(
                  JSON.stringify(
                    Message.parse({ id: message.id, type: "token", token })
                  )
                );
              }
            )
              .then((answer) => {
                console.debug("[answer]", answer);
                worker.send(
                  JSON.stringify(
                    Message.parse({
                      id: message.id,
                      type: "answer",
                      answer: answer ?? "",
                    })
                  )
                );
              })
              .catch(console.error);
            break;
          case "evalSuccess":
            // no-op
            break;
          case "evalError":
            // no-op
            break;
          default:
            console.error("[unknown message type]", message);
        }
      }
    }

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("close", () => {
      console.debug("[close]");
      worker.removeEventListener("message", handleMessage);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  },
};
