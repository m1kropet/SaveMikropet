/* Минимальный WebSocket-сервер (RFC 6455) на встроенных модулях Node.js — без npm-зависимостей.
   Поддерживает текстовые сообщения, фрагментацию, ping/pong, закрытие и лимит размера кадра. */
'use strict';
const crypto = require('crypto');
const { EventEmitter } = require('events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_MESSAGE = 64 * 1024;

class Socket extends EventEmitter {
  constructor(sock) {
    super();
    this.sock = sock;
    this.buf = Buffer.alloc(0);
    this.frags = [];
    this.readyState = 1;
    this.alive = true;
    sock.setNoDelay(true);
    sock.on('data', d => this.onData(d));
    sock.on('close', () => this.finish());
    sock.on('error', () => this.finish());
  }
  finish() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.emit('close');
  }
  onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    for (;;) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0, op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (len > MAX_MESSAGE || !masked) { this.close(1009); return; }
      if (this.buf.length < off + 4 + len) return;
      const mask = this.buf.subarray(off, off + 4);
      const data = Buffer.from(this.buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      this.buf = this.buf.subarray(off + 4 + len);
      if (op === 0x8) { this.close(1000); return; }
      if (op === 0x9) { this.frame(0xA, data); continue; }
      if (op === 0xA) { this.alive = true; continue; }
      if (op === 0x1 || op === 0x2 || op === 0x0) {
        this.frags.push(data);
        if (this.frags.reduce((a, f) => a + f.length, 0) > MAX_MESSAGE) { this.close(1009); return; }
        if (fin) { const msg = Buffer.concat(this.frags).toString('utf8'); this.frags = []; this.emit('message', msg); }
      }
    }
  }
  frame(op, payload) {
    if (this.readyState !== 1) return;
    const len = payload.length;
    let head;
    if (len < 126) head = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
    this.sock.write(Buffer.concat([head, payload]));
  }
  send(text) { this.frame(0x1, Buffer.from(text, 'utf8')); }
  ping() { this.frame(0x9, Buffer.alloc(0)); }
  close(code) {
    if (this.readyState !== 1) return;
    const p = Buffer.alloc(2); p.writeUInt16BE(code || 1000, 0);
    this.frame(0x8, p);
    this.readyState = 2;
    this.sock.end();
    setTimeout(() => this.sock.destroy(), 1000).unref();
  }
}

// Подключает обработку Upgrade к http-серверу.
function attach(httpServer, path, onConnection) {
  const clients = new Set();
  httpServer.on('upgrade', (req, sock) => {
    const url = (req.url || '').split('?')[0];
    const key = req.headers['sec-websocket-key'];
    if (url !== path || !key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') { sock.destroy(); return; }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    const ws = new Socket(sock);
    clients.add(ws);
    onConnection(ws, req);
  });
  // проверка «живости» соединений
  const iv = setInterval(() => {
    for (const ws of clients) {
      if (ws.readyState !== 1) { clients.delete(ws); continue; }
      if (!ws.alive) { ws.close(1001); ws.sock.destroy(); continue; }
      ws.alive = false; ws.ping();
    }
  }, 20000);
  iv.unref();
  return { clients };
}

module.exports = { attach, Socket };
