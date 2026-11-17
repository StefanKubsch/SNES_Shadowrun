// SPC700-Referenzinterpreter nur für Tests (nie in src/). Er führt die
// Originalbefehle des Soundtreibers aus, damit der native Treiber
// (src/apu/sound-driver.mjs) gegen sie verglichen werden kann.
// Befehlssatz und Flags: Book I Anhang C (PDF 227-236), Längen per
// Mesen-SPC-Trace bestätigt (tools/sound-driver.test.mjs). Implementiert sind
// die 104 Opcodes des Treibers; jeder andere ist ein Fehler.
// Ablauf wie der native Treiber: next() läuft bis zu einer Wartestelle und
// liefert {value: WAIT_PORT|IDLE|IPL}. Wartestellen sind die Portabfragen
// 0224/0625/0663/0358 (Rücksprung genommen) und das Ende eines
// Hauptschleifendurchlaufs ohne Wirkung (gleiches Kriterium wie nativ).
import { WAIT_PORT, IDLE, IPL } from '../src/apu/sound-driver.mjs';

const N = 0x80,
  V = 0x40,
  P = 0x20,
  H = 0x08,
  Z = 0x02,
  C = 0x01;
const POLLS = new Map([
  [0x0226, 0x0224],
  [0x0628, 0x0625],
  [0x0666, 0x0663],
  [0x035b, 0x0358],
]);

export class Spc700Reference {
  constructor(ram, io, pc = 0x0200) {
    this.ram = ram;
    this.io = io;
    this.a = 0;
    this.x = 0;
    this.y = 0;
    this.sp = 0xef;
    this.psw = 0;
    this.pc = pc;
    this.coverage = new Set();
    this.passOpen = false;
    this.minSp = 0xef;
    this.ioAccess = null; // optional Map pc -> Set von Adressen (Prüfung der I/O-Stellen)
  }
  read(address) {
    address &= 0xffff;
    if ((address & 0xfff0) === 0xf0) {
      this.ioAccess?.get(this.op0)?.add(address) ??
        this.ioAccess?.set(this.op0, new Set([address]));
      return this.io.read(address, this.op0);
    }
    return this.ram[address];
  }
  write(address, value) {
    address &= 0xffff;
    value &= 255;
    if ((address & 0xfff0) === 0xf0) {
      this.ioAccess?.get(this.op0)?.add(address) ??
        this.ioAccess?.set(this.op0, new Set([address]));
      this.io.write(address, value, this.op0);
      return;
    }
    this.ram[address] = value;
  }
  fetch() {
    const v = this.ram[this.pc];
    this.pc = (this.pc + 1) & 0xffff;
    return v;
  }
  push(v) {
    this.ram[0x100 | this.sp] = v & 255;
    this.sp = (this.sp - 1) & 255;
    if (this.sp < this.minSp) this.minSp = this.sp;
  }
  pop() {
    this.sp = (this.sp + 1) & 255;
    return this.ram[0x100 | this.sp];
  }
  nz(v) {
    v &= 255;
    this.psw = (this.psw & ~(N | Z)) | (v & N) | (v ? 0 : Z);
    return v;
  }
  setC(c) {
    this.psw = c ? this.psw | C : this.psw & ~C;
  }
  dp(d) {
    return (this.psw & P ? 0x100 : 0) | (d & 255);
  }
  word(d) {
    return this.read(this.dp(d)) | (this.read(this.dp(d + 1)) << 8);
  }
  adc(a, b) {
    const c = this.psw & C,
      r = a + b + c;
    this.psw &= ~(V | H | C);
    if (~(a ^ b) & (a ^ r) & 0x80) this.psw |= V;
    if ((a & 15) + (b & 15) + c > 15) this.psw |= H;
    if (r > 255) this.psw |= C;
    return this.nz(r);
  }
  sbc(a, b) {
    return this.adc(a, b ^ 255);
  }
  cmp(a, b) {
    const r = a - b;
    this.setC(r >= 0);
    this.nz(r);
  }
  asl(v) {
    this.setC(v & 0x80);
    return this.nz(v << 1);
  }
  lsr(v) {
    this.setC(v & 1);
    return this.nz(v >> 1);
  }
  rol(v) {
    const c = this.psw & C;
    this.setC(v & 0x80);
    return this.nz((v << 1) | c);
  }
  ror(v) {
    const c = this.psw & C;
    this.setC(v & 1);
    return this.nz((v >> 1) | (c << 7));
  }
  branch(take) {
    const r = this.fetch();
    if (take) this.pc = (this.pc + ((r << 24) >> 24)) & 0xffff;
  }
  // Läuft bis zur nächsten Wartestelle.
  next() {
    for (;;) {
      if (this.pc === 0x0244) {
        if (
          this.passOpen &&
          this.io.counterTicks === this.pass.ticks &&
          this.io.portWrites === this.pass.writes &&
          this.ram[0x49] === this.pass.keyOn &&
          this.ram[0x4a] === this.pass.keyOff
        ) {
          this.passOpen = false;
          return { value: IDLE, done: false };
        }
        this.passOpen = true;
        this.pass = {
          ticks: this.io.counterTicks,
          writes: this.io.portWrites,
          keyOn: this.ram[0x49],
          keyOff: this.ram[0x4a],
        };
      }
      if (this.pc === 0xffc0) return { value: IPL, done: true };
      const at = this.pc;
      this.step();
      if (POLLS.get(at) === this.pc) return { value: WAIT_PORT, done: false };
    }
  }
  step() {
    const at = (this.op0 = this.pc),
      op = this.fetch();
    this.coverage.add(at);
    let d, w, v;
    switch (op) {
      // Logik/Arithmetik mit A
      case 0x04:
        this.a = this.nz(this.a | this.read(this.dp(this.fetch())));
        break;
      case 0x08:
        this.a = this.nz(this.a | this.fetch());
        break;
      case 0x14:
        this.a = this.nz(this.a | this.read(this.dp(this.fetch() + this.x)));
        break;
      case 0x15:
        w = this.fetch() | (this.fetch() << 8);
        this.a = this.nz(this.a | this.read(w + this.x));
        break;
      case 0x24:
        this.a = this.nz(this.a & this.read(this.dp(this.fetch())));
        break;
      case 0x28:
        this.a = this.nz(this.a & this.fetch());
        break;
      case 0x44:
        this.a = this.nz(this.a ^ this.read(this.dp(this.fetch())));
        break;
      case 0x48:
        this.a = this.nz(this.a ^ this.fetch());
        break;
      case 0x64:
        this.cmp(this.a, this.read(this.dp(this.fetch())));
        break;
      case 0x68:
        this.cmp(this.a, this.fetch());
        break;
      case 0x74:
        this.cmp(this.a, this.read(this.dp(this.fetch() + this.x)));
        break;
      case 0x75:
        w = this.fetch() | (this.fetch() << 8);
        this.cmp(this.a, this.read(w + this.x));
        break;
      case 0x84:
        this.a = this.adc(this.a, this.read(this.dp(this.fetch())));
        break;
      case 0x88:
        this.a = this.adc(this.a, this.fetch());
        break;
      case 0x94:
        this.a = this.adc(this.a, this.read(this.dp(this.fetch() + this.x)));
        break;
      case 0x95:
        w = this.fetch() | (this.fetch() << 8);
        this.a = this.adc(this.a, this.read(w + this.x));
        break;
      case 0xa4:
        this.a = this.sbc(this.a, this.read(this.dp(this.fetch())));
        break;
      case 0xa8:
        this.a = this.sbc(this.a, this.fetch());
        break;
      case 0xb5:
        w = this.fetch() | (this.fetch() << 8);
        this.a = this.sbc(this.a, this.read(w + this.x));
        break;
      // Speicher-Speicher (dd,ds: Quelle zuerst kodiert)
      case 0x09: {
        const s = this.fetch(),
          t = this.fetch();
        v = this.read(this.dp(s));
        this.write(this.dp(t), this.nz(this.read(this.dp(t)) | v));
        break;
      }
      case 0x69: {
        const s = this.fetch(),
          t = this.fetch();
        v = this.read(this.dp(s));
        this.cmp(this.read(this.dp(t)), v);
        break;
      }
      case 0x78: {
        const i = this.fetch(),
          t = this.fetch();
        this.cmp(this.read(this.dp(t)), i);
        break;
      }
      case 0x8f: {
        const i = this.fetch(),
          t = this.fetch();
        this.write(this.dp(t), i);
        break;
      }
      case 0xfa: {
        const s = this.fetch(),
          t = this.fetch();
        this.write(this.dp(t), this.read(this.dp(s)));
        break;
      }
      case 0xad:
        this.cmp(this.y, this.fetch());
        break;
      case 0xc8:
        this.cmp(this.x, this.fetch());
        break;
      case 0x7e:
        this.cmp(this.y, this.read(this.dp(this.fetch())));
        break;
      // Schieben/Zählen
      case 0x0b:
        d = this.dp(this.fetch());
        this.write(d, this.asl(this.read(d)));
        break;
      case 0x1c:
        this.a = this.asl(this.a);
        break;
      case 0x2b:
        d = this.dp(this.fetch());
        this.write(d, this.rol(this.read(d)));
        break;
      case 0x3c:
        this.a = this.rol(this.a);
        break;
      case 0x4b:
        d = this.dp(this.fetch());
        this.write(d, this.lsr(this.read(d)));
        break;
      case 0x5c:
        this.a = this.lsr(this.a);
        break;
      case 0x6b:
        d = this.dp(this.fetch());
        this.write(d, this.ror(this.read(d)));
        break;
      case 0x7c:
        this.a = this.ror(this.a);
        break;
      case 0x8b:
        d = this.dp(this.fetch());
        this.write(d, this.nz(this.read(d) - 1));
        break;
      case 0x8c:
        w = this.fetch() | (this.fetch() << 8);
        this.write(w, this.nz(this.read(w) - 1));
        break;
      case 0x9b:
        d = this.dp(this.fetch() + this.x);
        this.write(d, this.nz(this.read(d) - 1));
        break;
      case 0xab:
        d = this.dp(this.fetch());
        this.write(d, this.nz(this.read(d) + 1));
        break;
      case 0xbb:
        d = this.dp(this.fetch() + this.x);
        this.write(d, this.nz(this.read(d) + 1));
        break;
      case 0x1d:
        this.x = this.nz(this.x - 1);
        break;
      case 0x3d:
        this.x = this.nz(this.x + 1);
        break;
      case 0x9c:
        this.a = this.nz(this.a - 1);
        break;
      case 0xbc:
        this.a = this.nz(this.a + 1);
        break;
      case 0xdc:
        this.y = this.nz(this.y - 1);
        break;
      case 0xfc:
        this.y = this.nz(this.y + 1);
        break;
      case 0x9f:
        this.a = this.nz((this.a << 4) | (this.a >> 4));
        break;
      // 16 Bit
      case 0x1a:
        d = this.fetch();
        w = (this.word(d) - 1) & 0xffff;
        this.write(this.dp(d), w);
        this.write(this.dp(d + 1), w >> 8);
        this.psw = (this.psw & ~(N | Z)) | (w & 0x8000 ? N : 0) | (w ? 0 : Z);
        break;
      case 0x3a:
        d = this.fetch();
        w = (this.word(d) + 1) & 0xffff;
        this.write(this.dp(d), w);
        this.write(this.dp(d + 1), w >> 8);
        this.psw = (this.psw & ~(N | Z)) | (w & 0x8000 ? N : 0) | (w ? 0 : Z);
        break;
      case 0x7a: {
        d = this.fetch();
        const ya = (this.y << 8) | this.a,
          m = this.word(d),
          r = ya + m;
        this.psw &= ~(N | V | H | Z | C);
        if (~(ya ^ m) & (ya ^ r) & 0x8000) this.psw |= V;
        if ((ya & 0xfff) + (m & 0xfff) > 0xfff) this.psw |= H;
        if (r > 0xffff) this.psw |= C;
        if (r & 0x8000) this.psw |= N;
        if (!(r & 0xffff)) this.psw |= Z;
        this.a = r & 255;
        this.y = (r >> 8) & 255;
        break;
      }
      case 0xba:
        d = this.fetch();
        this.a = this.read(this.dp(d));
        this.y = this.read(this.dp(d + 1));
        w = (this.y << 8) | this.a;
        this.psw = (this.psw & ~(N | Z)) | (w & 0x8000 ? N : 0) | (w ? 0 : Z);
        break;
      case 0xda:
        d = this.fetch();
        this.write(this.dp(d), this.a);
        this.write(this.dp(d + 1), this.y);
        break;
      case 0xcf:
        w = this.y * this.a;
        this.a = w & 255;
        this.y = w >> 8;
        this.nz(this.y);
        break;
      case 0x9e: {
        const ya = (this.y << 8) | this.a,
          x = this.x;
        this.psw &= ~(V | H);
        if (this.y >= x) this.psw |= V;
        if ((this.y & 15) >= (x & 15)) this.psw |= H;
        if (this.y < x << 1) {
          this.a = Math.floor(ya / x) & 255;
          this.y = (ya % x) & 255;
        } else {
          this.a = (255 - Math.floor((ya - (x << 9)) / (256 - x))) & 255;
          this.y = (x + ((ya - (x << 9)) % (256 - x))) & 255;
        }
        this.nz(this.a);
        break;
      }
      // Bits
      case 0x13:
      case 0x33:
      case 0x53: {
        const bit = op >> 5;
        d = this.fetch();
        v = this.read(this.dp(d));
        this.branch(!((v >> bit) & 1));
        break;
      }
      // Sprünge
      case 0x10:
        this.branch(!(this.psw & N));
        break;
      case 0x30:
        this.branch(this.psw & N);
        break;
      case 0x90:
        this.branch(!(this.psw & C));
        break;
      case 0xb0:
        this.branch(this.psw & C);
        break;
      case 0xd0:
        this.branch(!(this.psw & Z));
        break;
      case 0xf0:
        this.branch(this.psw & Z);
        break;
      case 0x2f:
        this.branch(true);
        break;
      case 0x3f:
        w = this.fetch() | (this.fetch() << 8);
        this.push(this.pc >> 8);
        this.push(this.pc);
        this.pc = w;
        break;
      case 0x5f:
        this.pc = this.fetch() | (this.fetch() << 8);
        break;
      case 0x6f:
        this.pc = this.pop() | (this.pop() << 8);
        break;
      // Stapel und Flags
      case 0x2d:
        this.push(this.a);
        break;
      case 0x4d:
        this.push(this.x);
        break;
      case 0x6d:
        this.push(this.y);
        break;
      case 0xae:
        this.a = this.pop();
        break;
      case 0xce:
        this.x = this.pop();
        break;
      case 0xee:
        this.y = this.pop();
        break;
      case 0x20:
        this.psw &= ~P;
        break;
      case 0x60:
        this.psw &= ~C;
        break;
      case 0x80:
        this.psw |= C;
        break;
      case 0xc0:
        this.psw &= ~0x04;
        break;
      case 0xbd:
        this.sp = this.x;
        break;
      // Transfer
      case 0x5d:
        this.x = this.nz(this.a);
        break;
      case 0x7d:
        this.a = this.nz(this.x);
        break;
      case 0xdd:
        this.a = this.nz(this.y);
        break;
      case 0xfd:
        this.y = this.nz(this.a);
        break;
      case 0x8d:
        this.y = this.nz(this.fetch());
        break;
      case 0xcd:
        this.x = this.nz(this.fetch());
        break;
      case 0xe8:
        this.a = this.nz(this.fetch());
        break;
      case 0xe4:
        this.a = this.nz(this.read(this.dp(this.fetch())));
        break;
      case 0xe5:
        w = this.fetch() | (this.fetch() << 8);
        this.a = this.nz(this.read(w));
        break;
      case 0xf4:
        this.a = this.nz(this.read(this.dp(this.fetch() + this.x)));
        break;
      case 0xf5:
        w = this.fetch() | (this.fetch() << 8);
        this.a = this.nz(this.read(w + this.x));
        break;
      case 0xf6:
        w = this.fetch() | (this.fetch() << 8);
        this.a = this.nz(this.read(w + this.y));
        break;
      case 0xf7:
        d = this.fetch();
        this.a = this.nz(this.read(this.word(d) + this.y));
        break;
      case 0xe9:
        w = this.fetch() | (this.fetch() << 8);
        this.x = this.nz(this.read(w));
        break;
      case 0xf8:
        this.x = this.nz(this.read(this.dp(this.fetch())));
        break;
      case 0xeb:
        this.y = this.nz(this.read(this.dp(this.fetch())));
        break;
      case 0xfb:
        this.y = this.nz(this.read(this.dp(this.fetch() + this.x)));
        break;
      case 0xc4:
        this.write(this.dp(this.fetch()), this.a);
        break;
      case 0xc5:
        w = this.fetch() | (this.fetch() << 8);
        this.write(w, this.a);
        break;
      case 0xc9:
        w = this.fetch() | (this.fetch() << 8);
        this.write(w, this.x);
        break;
      case 0xcb:
        this.write(this.dp(this.fetch()), this.y);
        break;
      case 0xd4:
        this.write(this.dp(this.fetch() + this.x), this.a);
        break;
      case 0xd5:
        w = this.fetch() | (this.fetch() << 8);
        this.write(w + this.x, this.a);
        break;
      case 0xd6:
        w = this.fetch() | (this.fetch() << 8);
        this.write(w + this.y, this.a);
        break;
      case 0xd7:
        d = this.fetch();
        this.write(this.word(d) + this.y, this.a);
        break;
      case 0xd8:
        this.write(this.dp(this.fetch()), this.x);
        break;
      default:
        throw Error(`spc700_reference_opcode ${op.toString(16)} at ${at.toString(16)}`);
    }
  }
}
