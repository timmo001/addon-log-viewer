import { LitElement, html, css } from 'lit';
import { Stylize } from '../utils/stylize.js';
import { Retry } from '../utils/retry.js';
import './status-bar.js';

/**
 * LogViewer - Main component for log viewing with WebSocket connectivity
 */
export class LogViewer extends LitElement {
  static properties = {
    status: { type: String },
    autoScroll: { type: Boolean },
    autoScrollDisabled: { type: Boolean },
    connected: { type: Boolean },
    canConnect: { type: Boolean },
    canDisconnect: { type: Boolean },
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100%;
      overflow: hidden;
    }

    .log {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 10px;
      background-color: #2b2b2b;
      color: #e0e0e0;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.5;
      min-height: 0;
    }

    .log code {
      display: block;
    }

    .log-line {
      white-space: pre-wrap;
      word-wrap: break-word;
      transition: background-color 0.3s ease;
    }

    .log-line.highlight {
      background-color: dimgray;
    }

    .spacer {
      height: 20px;
    }
  `;

  constructor() {
    super();

    // State
    this.status = 'Initializing';
    this.autoScroll = true;
    this.autoScrollDisabled = false;
    this.connected = false;
    this.canConnect = false;
    this.canDisconnect = true;
    this.reconnect = true;

    // Utilities
    this.stylize = new Stylize();
    this.retry = new Retry();

    // WebSocket
    this.ws = null;
    this.wsUrl = this._buildWsUrl();

    // Setup retry handlers
    this.retry.addEventListener('retry', () => this._openWs());
    this.retry.addEventListener('tick', () => {
      this.status = `Retry in ${this.retry.seconds}s...`;
    });
  }

  connectedCallback() {
    super.connectedCallback();
    // Start connection on mount
    this._openWs();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up WebSocket on unmount
    if (this.ws) {
      this.ws.close();
    }
    this.retry.stop();
  }

  _buildWsUrl() {
    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${loc.host}${loc.pathname}`;
  }

  _openWs() {
    this.status = 'Connecting';
    this.ws = new WebSocket(this.wsUrl);
    window._ws = this.ws; // For debugging

    this.ws.onopen = () => this._handleOpen();
    this.ws.onclose = () => this._handleClose();
    this.ws.onerror = () => this._handleError();
    this.ws.onmessage = (event) => this._handleMessage(event);

    // Add helper methods to WebSocket
    this.ws.sendFrame = (frame) => this._sendFrame(frame);
    this.ws.parseFrame = (frame) => this._parseFrame(frame);
  }

  _handleOpen() {
    this.retry.stop();
    this.status = 'Connected';
    this.connected = true;
    this.canConnect = false;
    this.canDisconnect = true;

    // Request config and initial lines
    this.ws.sendFrame({
      type: 'getConfig',
      data: { key: 'filters' }
    });

    this.ws.sendFrame({
      type: 'getLines'
    });
  }

  _handleClose() {
    this.status = 'Disconnected';
    this.connected = false;
    this.canConnect = true;
    this.canDisconnect = false;

    if (this.reconnect) {
      this.retry.start();
    }
  }

  _handleError() {
    this.status = 'Error';
  }

  _handleMessage(event) {
    let frame;
    try {
      frame = JSON.parse(event.data);
    } catch (err) {
      console.log('Cannot parse JSON:', err);
      return;
    }

    if (frame.type === 'log') {
      const line = frame.data.line;
      const lineHash = this.stylize.hash(line);

      // Check for duplicates using the hash
      const existingLine = this.shadowRoot.querySelector('.h' + lineHash);
      if (!existingLine) {
        this._addLine(this.stylize.parse(line), lineHash);
      }
    } else if (frame.type === 'result' && frame.success && frame.result?.key === 'filters') {
      if (frame.result.value?.length) {
        this.stylize.map = frame.result.value;
      }
    } else {
      console.log('unhandled message:', frame);
    }
  }

  _sendFrame(frame) {
    frame.timestamp = Date.now();

    if (typeof frame.id === 'undefined') {
      frame.id = frame.timestamp;
    }

    if (frame.type === 'result') {
      frame.success = typeof frame.error === 'undefined';
    }

    if (frame.error) {
      console.error(frame.error.message);
    }

    this.ws.send(JSON.stringify(frame));
  }

  _parseFrame(frame) {
    try {
      frame = JSON.parse(frame);
    } catch (err) {
      this.ws.sendFrame({
        type: 'result',
        error: { message: err.message }
      });
      return false;
    }

    if (typeof frame.type === 'undefined') {
      this.ws.sendFrame({
        id: frame.id,
        type: 'result',
        error: { message: 'Frame type must be set' }
      });
      return false;
    }

    if (typeof frame.timestamp === 'undefined') {
      frame.timestamp = Date.now();
    }

    if (typeof frame.id === 'undefined') {
      frame.id = frame.timestamp;
    }

    return frame;
  }

  _addLine(line, lineHash) {
    const logCode = this.shadowRoot.querySelector('.log code');
    if (!logCode) return;

    const lineDiv = document.createElement('div');
    lineDiv.className = 'log-line highlight h' + lineHash;
    lineDiv.innerHTML = line;

    logCode.appendChild(lineDiv);

    // Remove highlight after render
    setTimeout(() => {
      lineDiv.classList.remove('highlight');
    }, 1);

    this._maybeAutoScroll();
  }

  _maybeAutoScroll() {
    const shouldScroll = this.autoScroll && !this.autoScrollDisabled;

    if (shouldScroll) {
      const logEl = this.shadowRoot.querySelector('.log');
      if (logEl) {
        logEl.scrollTop = logEl.scrollHeight;
      }
    }
  }

  _handleScroll(e) {
    const logEl = e.target;
    const isAtBottom = logEl.scrollHeight - 5 <= logEl.offsetHeight + logEl.scrollTop;
    this.autoScrollDisabled = !isAtBottom;
  }

  // Command handlers
  handleConnect() {
    this.reconnect = true;
    this._openWs();
  }

  handleDisconnect() {
    this.reconnect = false;
    if (this.ws) {
      this.ws.close();
    }
  }

  handleToggleAutoscroll() {
    this.autoScroll = !this.autoScroll;
    this.autoScrollDisabled = false;
    this._maybeAutoScroll();
  }

  handleClearConsole() {
    const logCode = this.shadowRoot.querySelector('.log code');
    if (logCode) {
      logCode.innerHTML = '';
    }
  }

  render() {
    return html`
      <div class="log" @scroll=${this._handleScroll}>
        <code></code>
        <div class="spacer"></div>
      </div>
      <status-bar
        .status=${this.status}
        .canConnect=${this.canConnect}
        .canDisconnect=${this.canDisconnect}
        .autoScroll=${this.autoScroll}
        @connect=${this.handleConnect}
        @disconnect=${this.handleDisconnect}
        @toggle-autoscroll=${this.handleToggleAutoscroll}
        @clear-console=${this.handleClearConsole}
      ></status-bar>
    `;
  }
}

customElements.define('log-viewer', LogViewer);
