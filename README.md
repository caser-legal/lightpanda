# Lightpanda helper

Node scripts that drive a headless browser for fetch, search, scrape, and a small MCP server. This tree is not the Lightpanda Zig browser. If a native `lightpanda` binary is on disk it is used; otherwise the scripts fall back to Puppeteer (Chromium).

## Requirements

- Node.js 18 or newer
- npm

## Install

```sh
npm install
```

Optional native binary. Put the upstream Lightpanda executable at one of:

- `/opt/lightpanda/bin/lightpanda-native`
- `/opt/lightpanda/zig-out/bin/lightpanda`

Or set `LIGHTPANDA_HOME` to the directory that contains `bin/lightpanda-native` or `zig-out/bin/lightpanda`. Nightly builds are published by the upstream project at [lightpanda-io/browser](https://github.com/lightpanda-io/browser/releases/tag/nightly). This repo does not vendor that binary.

```sh
export LIGHTPANDA_HOME=/opt/lightpanda
export LIGHTPANDA_CDP_PORT=9222
```

## Commands

```sh
node bin/browser help
node bin/browser fetch https://example.com
node bin/browser scrape https://example.com
node bin/browser links https://example.com
node bin/search "browser automation"
node bin/serve
```

`bin/serve` listens for Chrome DevTools Protocol. With a native binary it runs `lightpanda serve`. Without one it launches Puppeteer with `--remote-debugging-port` (default **9222**). Connect with:

```js
const browser = await puppeteer.connect({
  browserWSEndpoint: "ws://127.0.0.1:9222",
});
```

`npm run search` calls `lib/agent-browser.js`. `npm run mcp` starts `integrations/mcp-server.js` on stdin/stdout.

## MCP client config

`integrations/claude-code-mcp.json` is an example. Point it at your checkout, not a fixed home directory:

```json
{
  "mcpServers": {
    "lightpanda": {
      "command": "node",
      "args": ["/opt/lightpanda/integrations/mcp-server.js"],
      "env": {
        "LIGHTPANDA_HOME": "/opt/lightpanda",
        "LIGHTPANDA_CDP_PORT": "9222"
      }
    }
  }
}
```

Replace `/opt/lightpanda` with the directory where you cloned this repo if that is where the scripts live.

## Layout

```
bin/browser    fetch, serve, search, scrape, links, eval
bin/search     DuckDuckGo HTML search via Puppeteer
bin/scrape     page text extraction
bin/serve      CDP server
lib/agent-browser.js
integrations/mcp-server.js
integrations/claude-code-mcp.json
```

Loopback `127.0.0.1` is the only address these examples use. Do not put API keys in this tree.
