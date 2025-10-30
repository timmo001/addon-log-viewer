#!/usr/bin/env node
/**
 * Home Assistant Log Viewer Server
 * Streams logs from 'ha core logs --follow' to WebSocket clients
 */

const express = require('express');
const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');

// Configuration
const PORT = process.env.PORT || 4277;
const MAX_BUFFER_LINES = 100;

// State
const logBuffer = [];
let haProcess = null;
let wss = null;

/**
 * Create Express app and WebSocket server
 */
function createServer() {
  const app = express();

  // Serve static frontend files
  app.use(express.static(path.join(__dirname, 'public')));

  // Create HTTP server
  const server = app.listen(PORT, () => {
    console.log(`Log Viewer server listening on port ${PORT}`);
  });

  // Create WebSocket server
  wss = new WebSocketServer({ server });

  wss.on('connection', handleConnection);

  return server;
}

/**
 * Handle new WebSocket connection
 */
function handleConnection(ws) {
  console.log('Client connected');

  // Send buffered log lines to new client
  logBuffer.forEach(line => {
    sendLogMessage(ws, line);
  });

  // Handle incoming messages from client
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleClientMessage(ws, message);
    } catch (err) {
      console.error('Error parsing client message:', err);
      sendErrorMessage(ws, 'Invalid message format');
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
}

/**
 * Handle messages from WebSocket clients
 */
function handleClientMessage(ws, message) {
  switch (message.type) {
    case 'getLines':
      // Send buffered lines to client
      logBuffer.forEach(line => {
        sendLogMessage(ws, line);
      });
      break;

    case 'getConfig':
      // Return configuration (filters, etc.)
      sendResultMessage(ws, message.id, {
        key: message.data?.key,
        value: getConfigValue(message.data?.key)
      });
      break;

    case 'setConfig':
      // Handle configuration updates
      if (message.data?.key === 'lines') {
        // Could adjust buffer size dynamically if needed
        sendResultMessage(ws, message.id, { success: true });
      } else {
        sendErrorMessage(ws, 'Only "lines" config can be changed', message.id);
      }
      break;

    default:
      console.warn('Unknown message type:', message.type);
  }
}

/**
 * Get configuration value
 */
function getConfigValue(key) {
  const config = {
    lines: MAX_BUFFER_LINES,
    filters: [
      { keyword: 'ERROR', style: 'color: #ff5555; font-weight: bold;' },
      { keyword: 'WARNING', style: 'color: #f1fa8c;' },
      { keyword: 'WARN', style: 'color: #f1fa8c;' },
      { keyword: 'INFO', style: 'color: #8be9fd;' },
      { keyword: 'DEBUG', style: 'color: #6272a4;' }
    ]
  };

  return key ? config[key] : config;
}

/**
 * Send log line to client(s)
 */
function sendLogMessage(ws, line) {
  const message = {
    type: 'log',
    timestamp: Date.now(),
    id: Date.now(),
    data: { line }
  };

  send(ws, message);
}

/**
 * Send result message to client
 */
function sendResultMessage(ws, id, result) {
  const message = {
    type: 'result',
    id: id || Date.now(),
    timestamp: Date.now(),
    success: true,
    result
  };

  send(ws, message);
}

/**
 * Send error message to client
 */
function sendErrorMessage(ws, errorMsg, id) {
  const message = {
    type: 'result',
    id: id || Date.now(),
    timestamp: Date.now(),
    success: false,
    error: { message: errorMsg }
  };

  send(ws, message);
}

/**
 * Send message to WebSocket client(s)
 */
function send(ws, message) {
  const data = JSON.stringify(message);

  if (ws.readyState === 1) {
    // Send to single client
    ws.send(data);
  } else if (ws === null && wss) {
    // Broadcast to all clients
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(data);
      }
    });
  }
}

/**
 * Broadcast log line to all connected clients
 */
function broadcast(line) {
  // Add to buffer
  logBuffer.push(line);
  if (logBuffer.length > MAX_BUFFER_LINES) {
    logBuffer.shift();
  }

  // Broadcast to all clients
  if (wss) {
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        sendLogMessage(client, line);
      }
    });
  }
}

/**
 * Spawn and monitor 'ha core logs --follow' process
 */
function startLogStreaming() {
  console.log('Starting log streaming: ha core logs --follow');

  haProcess = spawn('ha', ['core', 'logs', '--follow'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Create readline interface for line-by-line processing
  const rl = readline.createInterface({
    input: haProcess.stdout,
    crlfDelay: Infinity
  });

  rl.on('line', (line) => {
    if (line) {
      broadcast(line);
    }
  });

  haProcess.stderr.on('data', (data) => {
    console.error('HA CLI error:', data.toString());
  });

  haProcess.on('exit', (code, signal) => {
    console.error(`HA CLI process exited with code ${code}, signal ${signal}`);

    // Attempt to restart after a delay
    setTimeout(() => {
      console.log('Attempting to restart log streaming...');
      startLogStreaming();
    }, 5000);
  });

  haProcess.on('error', (err) => {
    console.error('Failed to start HA CLI:', err);

    // Attempt to restart after a delay
    setTimeout(() => {
      console.log('Attempting to restart log streaming...');
      startLogStreaming();
    }, 5000);
  });
}

/**
 * Graceful shutdown handler
 */
function shutdown() {
  console.log('Shutting down...');

  if (haProcess) {
    haProcess.kill('SIGTERM');
  }

  if (wss) {
    wss.clients.forEach(client => {
      client.close();
    });
    wss.close();
  }

  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the server
createServer();
startLogStreaming();

console.log('Log Viewer started successfully');
