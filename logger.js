const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const logPath = path.join(app.getPath('userData'), 'app.log');

function formatMsg(level, msg, ...args) {
  const timestamp = new Date().toISOString();
  let text = `[${timestamp}] [${level}] ${msg}`;
  if (args.length > 0) {
    const argsStr = args.map(a => (a instanceof Error ? a.stack : typeof a === 'object' ? JSON.stringify(a) : a)).join(' ');
    text += ` ${argsStr}`;
  }
  return text + '\n';
}

function info(msg, ...args) {
  const text = formatMsg('INFO', msg, ...args);
  console.log(`[INFO] ${msg}`, ...args);
  try { fs.appendFileSync(logPath, text); } catch (e) {}
}

function error(msg, ...args) {
  const text = formatMsg('ERROR', msg, ...args);
  console.error(`[ERROR] ${msg}`, ...args);
  try { fs.appendFileSync(logPath, text); } catch (e) {}
}

module.exports = { info, error, logPath };
