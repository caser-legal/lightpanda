#!/usr/bin/env node
const { LightpandaClient } = require('../lib/agent-browser');

let browser = null;

const TOOLS = [
  { name: 'goto', description: 'Navigate to a URL', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'markdown', description: 'Get page content as markdown', inputSchema: { type: 'object', properties: { url: { type: 'string' } } } },
  { name: 'links', description: 'Extract all links', inputSchema: { type: 'object', properties: { url: { type: 'string' } } } },
  { name: 'evaluate', description: 'Execute JavaScript', inputSchema: { type: 'object', properties: { script: { type: 'string' }, url: { type: 'string' } }, required: ['script'] } },
  { name: 'search', description: 'Search DuckDuckGo', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'interactiveElements', description: 'Get buttons, inputs, links', inputSchema: { type: 'object', properties: { url: { type: 'string' } } } },
  { name: 'semanticTree', description: 'Get simplified DOM tree', inputSchema: { type: 'object', properties: { url: { type: 'string' } } } },
];

async function ensureBrowser() {
  if (!browser) { browser = new LightpandaClient(); await browser.connect(); }
  return browser;
}

async function handleToolCall(name, args) {
  const b = await ensureBrowser();
  switch (name) {
    case 'goto': await b.goto(args.url); return { content: [{ type: 'text', text: `Navigated to ${args.url}` }] };
    case 'markdown': if (args.url) await b.goto(args.url); return { content: [{ type: 'text', text: await b.getMarkdown() }] };
    case 'links': if (args.url) await b.goto(args.url); return { content: [{ type: 'text', text: JSON.stringify(await b.getLinks(), null, 2) }] };
    case 'evaluate': if (args.url) await b.goto(args.url); return { content: [{ type: 'text', text: String(await b.evaluate(args.script)) }] };
    case 'search': return { content: [{ type: 'text', text: JSON.stringify(await b.search(args.query), null, 2) }] };
    case 'interactiveElements': if (args.url) await b.goto(args.url); return { content: [{ type: 'text', text: JSON.stringify(await b.getInteractiveElements(), null, 2) }] };
    case 'semanticTree': if (args.url) await b.goto(args.url); return { content: [{ type: 'text', text: JSON.stringify(await b.getSemanticTree(), null, 2) }] };
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

async function main() {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  rl.on('line', async (line) => {
    try {
      const message = JSON.parse(line);
      switch (message.method) {
        case 'initialize': sendResponse(message.id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'lightpanda', version: '1.0.0' } }); break;
        case 'tools/list': sendResponse(message.id, { tools: TOOLS }); break;
        case 'tools/call': const result = await handleToolCall(message.params.name, message.params.arguments || {}); sendResponse(message.id, result); break;
        case 'ping': sendResponse(message.id, {}); break;
        default: sendError(message.id, { code: -32601, message: `Method not found: ${message.method}` });
      }
    } catch (error) { console.error('MCP Error:', error.message); }
  });

  function sendResponse(id, result) { console.log(JSON.stringify({ jsonrpc: '2.0', id, result })); }
  function sendError(id, error) { console.log(JSON.stringify({ jsonrpc: '2.0', id, error })); }
}

main().catch(console.error);
