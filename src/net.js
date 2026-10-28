import { Peer } from 'peerjs';

const PREFIX = 'battleship-bonanza-';
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const JOIN_TIMEOUT = 12000;
export const MAX_GUESTS = 5;
export const CODE_LENGTH = 4;

const makeCode = () => Array.from({ length: CODE_LENGTH }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');

function openPeer(id) {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 });
    const fail = (err) => {
      peer.destroy();
      reject(err);
    };
    peer.once('open', () => {
      peer.off('error', fail);
      resolve(peer);
    });
    peer.once('error', fail);
  });
}

export class Session {
  constructor() {
    this.handlers = {};
    this.reset();
  }

  reset() {
    this.peer = null;
    this.role = null;
    this.code = null;
    this.guests = new Map();
    this.host = null;
  }

  get active() {
    return this.role !== null;
  }

  on(type, fn) {
    this.handlers[type] = fn;
  }

  fire(type, ...args) {
    this.handlers[type]?.(...args);
  }

  async hostRoom() {
    let peer = null;
    let code = null;
    for (let tries = 0; !peer && tries < 5; tries++) {
      code = makeCode();
      try {
        peer = await openPeer(PREFIX + code);
      } catch (err) {
        if (err.type !== 'unavailable-id') throw err;
      }
    }
    if (!peer) throw new Error('unavailable-id');
    this.peer = peer;
    this.role = 'host';
    this.code = code;
    peer.on('connection', (conn) => {
      conn.on('open', () => {
        if (this.guests.size >= MAX_GUESTS) {
          conn.send({ t: 'full' });
          setTimeout(() => conn.close(), 400);
          return;
        }
        this.guests.set(conn.peer, conn);
      });
      conn.on('data', (msg) => this.guests.has(conn.peer) && this.fire('message', msg, conn.peer));
      conn.on('close', () => this.guests.delete(conn.peer) && this.fire('leave', conn.peer));
      conn.on('error', () => conn.close());
    });
    peer.on('disconnected', () => {
      if (this.peer === peer && !peer.destroyed) peer.reconnect();
    });
  }

  async joinRoom(code) {
    const peer = await openPeer();
    const conn = peer.connect(PREFIX + code, { reliable: true });
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { type: 'timeout' })), JOIN_TIMEOUT);
        conn.once('open', () => {
          clearTimeout(timer);
          resolve();
        });
        peer.once('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
    } catch (err) {
      peer.destroy();
      throw err;
    }
    this.peer = peer;
    this.role = 'guest';
    this.code = code;
    this.host = conn;
    conn.on('data', (msg) => this.fire('message', msg));
    conn.on('close', () => this.peer === peer && this.fire('lost'));
    peer.on('error', () => this.peer === peer && this.fire('lost'));
  }

  send(msg, to = null) {
    const conns = this.role === 'guest' ? [this.host] : to ? [this.guests.get(to)] : [...this.guests.values()];
    for (const conn of conns) {
      if (!conn?.open) continue;
      try {
        conn.send(msg);
      } catch (err) {
        console.error('send', msg?.t, err);
      }
    }
  }

  leave() {
    const peer = this.peer;
    this.reset();
    peer?.destroy();
  }
}
