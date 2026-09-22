#!/usr/bin/env node
const WebSocket = require('ws');

class LightpandaClient {
  constructor(options = {}) {
    this.cdpHost = options.host || '127.0.0.1';
    this.cdpPort = options.port || process.env.LIGHTPANDA_CDP_PORT || '9222';
    this.wsUrl = `ws://${this.cdpHost}:${this.cdpPort}`;
    this.ws = null;
    this.pageId = null;
    this.sessionId = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', async () => {
        const targets = await this._send('Target.getTargets');
        if (targets.targetInfos && targets.targetInfos.length > 0) {
          this.pageId = targets.targetInfos[0].targetId;
        }
        if (!this.pageId) {
          const target = await this._send('Target.createTarget', { url: 'about:blank' });
          this.pageId = target.targetId;
        }
        const session = await this._send('Target.attachToTarget', { targetId: this.pageId });
        this.sessionId = session.sessionId;
        resolve();
      });
      this.ws.on('error', reject);
      this.ws.on('close', () => { this.ws = null; });
    });
  }

  async goto(url, options = {}) {
    const waitUntil = options.waitUntil || 'networkidle0';
    const timeout = options.timeout || 30000;
    const result = await this._send('Page.navigate', { url });
    if (waitUntil !== 'none') await this._waitForLoadState(waitUntil, timeout);
    return result;
  }

  async evaluate(script) {
    const result = await this._send('Runtime.evaluate', { expression: script, returnByValue: true });
    return result.result.value;
  }

  async getLinks() {
    return await this.evaluate(`Array.from(document.querySelectorAll('a[href]')).map(a => ({ text: a.textContent.trim(), href: a.href })).filter(l => l.href && l.text)`);
  }

  async getMarkdown() {
    return await this.evaluate(`document.body.innerText`);
  }

  async getInteractiveElements() {
    return await this.evaluate(`({ buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()), inputs: Array.from(document.querySelectorAll('input')).map(i => ({ type: i.type, name: i.name })), links: Array.from(document.querySelectorAll('a[href]')).map(a => ({ text: a.textContent.trim(), href: a.href })) })`);
  }

  async getSemanticTree() {
    return await this.evaluate(`function buildSemanticTree(node, depth = 0) { if (depth > 5 || !node.tagName) return null; const meaningful = ['A', 'BUTTON', 'INPUT', 'FORM', 'TABLE', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'IMG']; if (!meaningful.includes(node.tagName)) { const children = []; for (const child of node.children) { const tree = buildSemanticTree(child, depth + 1); if (tree) children.push(tree); } return children.length ? { tag: node.tagName, children } : null; } return { tag: node.tagName, id: node.id || undefined, class: node.className || undefined, text: node.innerText?.slice(0, 100) || undefined, href: node.href || undefined, children: [] }; } buildSemanticTree(document.body);`);
  }

  async search(query) {
    const encodedQuery = encodeURIComponent(query);
    await this.goto(`https://html.duckduckgo.com/html/?q=${encodedQuery}`);
    return await this.evaluate(`Array.from(document.querySelectorAll('.result')).map(r => ({ title: r.querySelector('.result__title')?.textContent.trim() || '', url: r.querySelector('.result__a')?.href || '', snippet: r.querySelector('.result__snippet')?.textContent.trim() || '' })).filter(r => r.url)`);
  }

  async close() {
    if (this.ws) { this.ws.close(); this.ws = null; }
  }

  async _send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = Date.now();
      const message = { id, method, params };
      const handler = (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          this.ws.removeListener('message', handler);
          if (response.error) reject(new Error(response.error.message));
          else resolve(response.result);
        }
      };
      this.ws.on('message', handler);
      this.ws.send(JSON.stringify(message));
      setTimeout(() => { this.ws.removeListener('message', handler); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
    });
  }

  async _waitForLoadState(state, timeout) {
    const startTime = Date.now();
    const checkState = async () => {
      const readyState = await this.evaluate('document.readyState');
      if (readyState === 'complete' || readyState === state) return;
      if (Date.now() - startTime > timeout) { console.warn('Page load timeout'); return; }
      setTimeout(checkState, 100);
    };
    await checkState();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LightpandaClient };
}
