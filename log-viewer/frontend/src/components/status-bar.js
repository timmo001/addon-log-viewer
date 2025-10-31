import { LitElement, html, css } from 'lit';
import { tinykeys } from 'tinykeys';

/**
 * StatusBar - Status display and command hints with keyboard shortcuts
 */
export class StatusBar extends LitElement {
  static properties = {
    status: { type: String },
    canConnect: { type: Boolean },
    canDisconnect: { type: Boolean },
    autoScroll: { type: Boolean },
  };

  static styles = css`
    :host {
      display: flex;
      background-color: #1a1a1a;
      color: #e0e0e0;
      padding: 8px 12px;
      border-top: 1px solid #444;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 12px;
    }

    .status-bar-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .status {
      flex: 1;
    }

    .commands {
      display: flex;
      gap: 12px;
    }

    .command {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .command:hover {
      opacity: 0.8;
    }

    .command.hidden {
      display: none;
    }

    .hotkey {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: bold;
      font-size: 11px;
      min-width: 16px;
      text-align: center;
    }
  `;

  constructor() {
    super();
    this.status = '';
    this.canConnect = false;
    this.canDisconnect = true;
    this.autoScroll = true;
    this._unsubscribe = null;

    // Detect Mac for keyboard shortcuts
    this.isMac = !!navigator.platform.match(/Mac/i);
  }

  connectedCallback() {
    super.connectedCallback();
    this._setupKeyboardShortcuts();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._unsubscribe) {
      this._unsubscribe();
    }
  }

  _setupKeyboardShortcuts() {
    const clearKey = this.isMac ? '$mod+k' : 'Control+k';

    this._unsubscribe = tinykeys(window, {
      'c': (e) => {
        if (this.canConnect) {
          e.preventDefault();
          this._dispatchCommand('connect');
        }
      },
      'd': (e) => {
        if (this.canDisconnect) {
          e.preventDefault();
          this._dispatchCommand('disconnect');
        }
      },
      's': (e) => {
        e.preventDefault();
        this._dispatchCommand('toggle-autoscroll');
      },
      [clearKey]: (e) => {
        e.preventDefault();
        this._dispatchCommand('clear-console');
      }
    });
  }

  _dispatchCommand(command) {
    this.dispatchEvent(new CustomEvent(command, {
      bubbles: true,
      composed: true
    }));
  }

  _handleConnect(e) {
    e.preventDefault();
    this._dispatchCommand('connect');
  }

  _handleDisconnect(e) {
    e.preventDefault();
    this._dispatchCommand('disconnect');
  }

  _handleToggleAutoscroll(e) {
    e.preventDefault();
    this._dispatchCommand('toggle-autoscroll');
  }

  _handleClearConsole(e) {
    e.preventDefault();
    this._dispatchCommand('clear-console');
  }

  _getHotkeyDisplay(key) {
    if (key === '^k') {
      return this.isMac ? '⌘K' : 'CTRL+K';
    }
    return key.toUpperCase();
  }

  _getHotkeyColors() {
    // Get computed colors from parent context
    // For now, use hardcoded values that match the design
    return {
      fg: '#1a1a1a',
      bg: '#e0e0e0'
    };
  }

  render() {
    const colors = this._getHotkeyColors();

    return html`
      <div class="status-bar-content">
        <span class="status">${this.status}</span>
        <div class="commands">
          ${this.canConnect ? html`
            <span class="command connect" @click=${this._handleConnect}>
              <span class="hotkey" style="color: ${colors.fg}; background-color: ${colors.bg}">
                ${this._getHotkeyDisplay('c')}
              </span>
              Connect
            </span>
          ` : ''}

          ${this.canDisconnect ? html`
            <span class="command disconnect" @click=${this._handleDisconnect}>
              <span class="hotkey" style="color: ${colors.fg}; background-color: ${colors.bg}">
                ${this._getHotkeyDisplay('d')}
              </span>
              Disconnect
            </span>
          ` : ''}

          ${this.autoScroll ? html`
            <span class="command disable-autoscroll" @click=${this._handleToggleAutoscroll}>
              <span class="hotkey" style="color: ${colors.fg}; background-color: ${colors.bg}">
                ${this._getHotkeyDisplay('s')}
              </span>
              Disable Autoscroll
            </span>
          ` : html`
            <span class="command enable-autoscroll" @click=${this._handleToggleAutoscroll}>
              <span class="hotkey" style="color: ${colors.fg}; background-color: ${colors.bg}">
                ${this._getHotkeyDisplay('s')}
              </span>
              Enable Autoscroll
            </span>
          `}

          <span class="command clear-console" @click=${this._handleClearConsole}>
            <span class="hotkey" style="color: ${colors.fg}; background-color: ${colors.bg}">
              ${this._getHotkeyDisplay('^k')}
            </span>
            Clear Console
          </span>
        </div>
      </div>
    `;
  }
}

customElements.define('status-bar', StatusBar);
