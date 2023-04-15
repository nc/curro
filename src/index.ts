import * as dotenv from "dotenv";
import { IncomingMessage } from "http";
dotenv.config({ path: ".env.local", override: true });
import { Configuration, OpenAIApi } from "openai";
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const TRACES = Object.freeze({
  thought: "Thought:",
  action: "Action:",
  actionInput: "Action Input:",
  observation: "Observation:",
  finalAnswer: "Final Answer:",
});

const NO_NEWLINES = [TRACES.action, TRACES.actionInput];

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

Write a JS regexp that can extract the text inbetween each sequential pair of tokens. The text can include newlines except Action and Action Input which are always separated by one newline.

*/
const PARSER_REGEXP = new RegExp(
  `(${Object.values(TRACES).join("|")})([\\s\\S]*?)(?=${Object.values(
    TRACES
  ).join("|")}|$)`,
  "g"
);

type Tool = {
  name: string;
  description: string;
  fn: (input: string) => Promise<string>;
};

type Tools = {
  [key: string]: Tool;
};

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

const TOOLS = {
  Clock: {
    name: "Clock",
    description: "Get today's date",
    fn: async () => new Date().toString(),
  },
  Search: {
    name: "Search",
    description: "Search the web",
    fn: async (input: string) => {
      // node-fetch ts types are not available
      // but fetch is included from node 18 onwards
      // @ts-expect-error
      const response = await fetch(
        `https://www.google.com/search?q=${encodeURIComponent(input)}`
      );
      return await response.text();
    },
  },
  Compute: {
    name: "Compute",
    description: "Compute things by writing and evaluating JS code",
    fn: async (input: string) => {
      const { response } = await prompt(
        `You are a helpful assistant that writes JS code, do not output anything other than the code itself. No explanation. Just the code so it can be executed instantly. Write a JS function to return: ${input}\n And call the function at the end of the code.`
      );
      const result = response.data.choices[0]?.message.content;
      console.debug(`\nExecuting:\n\n\t${result.split("\n").join("\n\t")}`);
      return result ? eval(result) : "I don't know.";
    },
  },
};

async function prompt(prompt: string) {
  const response = await openai.createChatCompletion({
    temperature: 0,
    model: "gpt-3.5-turbo",
    messages: [{ role: "system", content: prompt }],
  });
  return { response };
}

async function chat(prompt: string, stop?: string | string[]) {
  const controller = new AbortController();
  const response = await openai.createChatCompletion(
    {
      temperature: 0,
      model: "gpt-3.5-turbo",
      messages: [{ role: "system", content: prompt }],
      stream: true,
      ...(stop ? { stop } : {}),
    },
    {
      responseType: "stream",
      signal: controller.signal,
    }
  );
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
  stream: IncomingMessage
): AsyncGenerator<string, void, string> {
  let data = "";
  for await (const chunk of stream) {
    data += chunk.toString();
    const payloads = data.split("\n\n");
    data = payloads.pop() || "";
    for (const payload of payloads) {
      yield parse(payload);
    }
  }
  if (data) {
    yield parse(data);
  }
}

async function agent(
  tools: Tools,
  prompt: string,
  scratchpad: string,
  depth: number,
  onToken: (token: string) => void = () => {}
) {
  if (depth > 5) {
    console.warn("Depth limit reached, aborting.");
    return;
  }

  const { response, controller } = await chat(
    ReActTemplate(Object.values(tools), prompt, scratchpad),
    [`\n${TRACES.observation}`]
  );
  const stream = tokenize(response.data as unknown as IncomingMessage);
  let output = `${scratchpad}`;
  let memory: { [key: string]: string } = {};

  if (depth === 0) {
    onToken(`${TRACES.thought} `);
  }

  for await (const token of stream) {
    if (!token) continue;
    output += token;
    onToken(token);
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
        const observation = await tool.fn(memory[TRACES.actionInput]);
        const observationPrompt = `\nObservation: ${observation}\n`;
        onToken(observationPrompt);
        const prior = `${output}${observationPrompt}`;
        return await agent(tools, prompt, prior, depth + 1, onToken);
      } catch (error) {
        console.error(`Error with ${tool.name}.\n${error}`);
      }
    } else {
      console.error(`Error with ${memory[TRACES.action]}. Could not find tool`);
    }
  }
}

async function run() {
  const answer = await agent(TOOLS, "What is tomorrows date?", "", 0, (token) =>
    process.stdout.write(token.toString())
  );
  console.log(`\n\nFinal Answer: ${answer}`);
  return;
}

run().then(() => process.exit(0));
