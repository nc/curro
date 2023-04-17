import { RemoteEvalReqest, Tool, Tools } from "./types";

const TRACES = Object.freeze({
  thought: "Thought:",
  action: "Action:",
  actionInput: "Action Input:",
  observation: "Observation:",
  finalAnswer: "Final Answer:",
});

const NO_NEWLINES: string[] = [TRACES.action, TRACES.actionInput];

interface Env {
  OPENAI_API_KEY: string;
}
/* 

Parses text between ReAct Traces
Generated with gpt-4 using the prompt:

For these traces: 

const TRACES = {
  answer: "Final Answer:",
  observation: "Observation:",
  thought: "Thought:",
  action: "Action:",
  actionInput: "Action Input:",
};

Write a JS regexp that can extract the text inbetween each sequential pair of tokens. 
The text can include newlines except Action and Action Input which are always separated by one newline.

*/
const PARSER_REGEXP = new RegExp(
  `(${Object.values(TRACES).join("|")})([\\s\\S]*?)(?=${Object.values(
    TRACES
  ).join("|")}|$)`,
  "g"
);

// ReAct: Synergizing Reasoning and Acting in Language Models
// https://arxiv.org/abs/2210.03629
const ReActTemplate = (tools: Tool[], prompt: string, scratchpad: string) => {
  return `Answer the following questions as best you can. You have access to the following tools: 
${tools.map((tool) => `${tool.name}: ${tool.description}`).join("\n")}

Use the following format:
Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [${tools
    .map((tool) => tool.name)
    .join(", ")}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question.

Begin!
Question: ${prompt}
Thought: ${scratchpad}`;
};

export const TOOLS = {
  Clock: {
    name: "Clock",
    description: "Get todays date",
    fn: async (env: Env, evalFn: RemoteEvalReqest, input: string) =>
      new Date().toString(),
  },
  // Search: {
  //   name: "Search",
  //   description: "Search the web",
  //   fn: async (env: Env, evalFn: RemoteEvalReqest, input: string) => {
  //     const response = await fetch(
  //       `https://www.google.com/search?q=${encodeURIComponent(input)}`
  //     );
  //     const html = await response.text();
  //     // const text = htmlParser.parse(html).innerText;
  //     return html;
  //   },
  // },
  Compute: {
    name: "Compute",
    description: "Compute things by writing and evaluating JS code",
    fn: async (env: Env, evalFn: RemoteEvalReqest, input: string) => {
      const { response } = await prompt(
        env,
        `You are a helpful assistant that writes JS code, do not output anything other than the code itself. No explanation. Just the code so it can be executed instantly. Write a JS function to return: ${input}\n And call the function at the end of the code.`
      );
      const js = ((await response.json()) as unknown as any).choices[0]?.message
        ?.content;
      js && console.debug(`\nExecuting:\n\n\t${js.split("\n").join("\n\t")}`);

      if (!js) {
        return "I don't know.";
      }

      const evalResponse = await evalFn(js);
      if (evalResponse.status === "error") {
        console.error("failed to eval", evalResponse.error);
        return "I don't know.";
      }

      return evalResponse.result;
    },
  },
  // FindAPI: {
  //   name: "FindAPI",
  //   description: "Find the API for a given function",
  //   fn: async (env: Env, evalFn: RemoteEvalReqest, input: string) => {
  //     console.log("Finding API for", input);
  //     const { response } = await prompt(
  //       env,
  //       `You are a helpful assistant that writes JS code, do not output anything other than the code itself. No explanation. Just the code so it can be executed instantly. Write a JS function to return the API for: ${input}\n And call the function at the end of the code.`
  //     );
  //     const result = ((await response.json()) as unknown as any).choices[0]
  //       ?.message?.content;
  //     result &&
  //       console.debug(`\nExecuting:\n\n\t${result.split("\n").join("\n\t")}`);
  //     return result ? eval(result) : "I don't know.";
  //   },
  // },
  // AskForHelp: {
  //   name: "AskForHelp",
  //   description: "Ask for help from a human",
  //   fn: async (env: Env, evalFn: RemoteEvalReqest, input: string) => {
  //     console.log("HELP!!!", input);
  //     return "I don't know.";
  //   },
  // },
  // WaitForConfirmation: {
  //   name: "WaitForConfirmation",
  //   description: "Wait for confirmation from a human for destructive actions",
  //   fn: async (env: Env, evalFn: RemoteEvalReqest, input: string) => {
  //     console.log("Waiting for confirmation", input);
  //     return "I don't know.";
  //   },
  // },
};

async function prompt(env: Env, prompt: string) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + env.OPENAI_API_KEY,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [{ role: "system", content: prompt }],
    }),
  });
  return { response };
}

async function chat(env: Env, prompt: string, stop?: string | string[]) {
  const controller = new AbortController();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + env.OPENAI_API_KEY,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [{ role: "system", content: prompt }],
      stream: true,
      ...(stop ? { stop } : {}),
    }),
    signal: controller.signal,
  });
  return { response, controller };
}

function parse(payload: string) {
  if (payload.includes("[DONE]")) return;
  if (payload.startsWith("data:")) {
    // in case there's multiline data event
    const data = payload.replaceAll(/(\n)?^data:\s*/g, "");
    try {
      const delta = JSON.parse(data.trim());
      const content = delta.choices[0].delta?.content;
      return content;
    } catch (error) {
      console.error(`Error with JSON.parse and ${payload}.\n${error}`);
    }
  }
}

async function* tokenize(
  reader: AsyncGenerator<string, string, void>
): AsyncGenerator<string, void, any> {
  let data = "";
  for await (const chunk of reader) {
    data += chunk.toString();
    const payloads = data.split("\n\n");
    data = payloads.pop() || "";
    for (const payload of payloads) {
      yield parse(payload);
    }
  }
  // if (data) {
  //   yield parse(data);
  // }
}

async function* read(reader: ReadableStreamDefaultReader) {
  // Create a new TextDecoder instance to decode the stream's contents
  const textDecoder = new TextDecoder("utf-8");
  let result = "";

  // Read the stream and decode its contents
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    yield textDecoder.decode(value);
  }

  return result;
}

export async function agent(
  env: Env,
  evalFn: RemoteEvalReqest,
  tools: Tools,
  prompt: string,
  scratchpad: string,
  depth: number,
  onToken: (token: string) => void = () => {}
): Promise<string | void> {
  if (depth > 5) {
    throw new Error("Depth limit reached, aborting.");
  }

  const { response, controller } = await chat(
    env,
    ReActTemplate(Object.values(tools), prompt, scratchpad),
    [`\n${TRACES.observation}`]
  );
  if (response.body == null) {
    throw new Error("No response body");
  }

  const reader = response.body.getReader();

  let output = `${scratchpad}`;

  for await (const token of tokenize(read(reader))) {
    output += token;
    onToken(token);
  }

  let memory: { [key: string]: string } = {};

  if (depth === 0) {
    onToken(`${TRACES.thought} `);
  }

  let result;
  while ((result = PARSER_REGEXP.exec(output))) {
    const trace = result[1];
    // action and action input are always separated by one newline
    const content = NO_NEWLINES.includes(trace)
      ? result[2].trim().split(/\r?\n/)[0]
      : result[2].trim();

    memory[trace] = content;
  }

  if (memory[TRACES.finalAnswer]) {
    controller.abort();
    return memory[TRACES.finalAnswer];
  }

  if (memory[TRACES.action] && memory[TRACES.actionInput]) {
    const tool = tools[memory[TRACES.action]];
    if (tool) {
      try {
        const observation = await tool.fn(
          env,
          evalFn,
          memory[TRACES.actionInput]
        );
        const observationPrompt = `\nObservation: ${observation}\n`;
        onToken(observationPrompt);
        const prior = `${output}${observationPrompt}`;
        return await agent(env, evalFn, tools, prompt, prior, depth++, onToken);
      } catch (error) {
        console.error(`Error with ${tool.name}.\n${error}`);
      }
    } else {
      console.error(`Error with ${memory[TRACES.action]}. Could not find tool`);
    }
  }
}

// async function run() {
//   const answer = await agent(TOOLS, process.argv[2], '', 0, (token) =>
//     process.stdout.write(token.toString())
//   );
//   console.log(`\n\nFinal Answer: ${answer}`);
//   return;
// }

// run().then(() => process.exit(0));
