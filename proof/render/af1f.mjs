import { renderOutputBytes } from './output-budget.mjs';

// Native AF1F data algorithm under an explicit uninterrupted arithmetic
// contract. Division results are host calculations, not device execution.
export function renderAF1F(view, { x, y, carry, overflow }, budget, divisionMode) {
  const readWord = (address) => view.read(address) | (view.read(address + 1) << 8);
  let wordWrites = 0,
    firstVisits = 0,
    middleVisits = 0;
  const tick = () => {
    if (++budget.work > budget.maxWork)
      throw { renderBoundary: true, reason: 'render_work_budget_required' };
  };
  const writeWord = (address, value, output = true) => {
    if (output) renderOutputBytes(budget, 2);
    tick();
    wordWrites++;
    view.write(address, value & 255);
    view.write(address + 1, value >>> 8);
  };
  const divisions = [];
  const divisionReads = [];
  let currentDivision;
  const divide = (dividend) => {
    currentDivision = Object.freeze({
      dividend,
      divisor: 20,
      quotient: Math.floor(dividend / 20),
      remainder: dividend % 20,
      // Declarative original requests only; no I/O is applied by commit.
      dividendRegister: 0x804204,
      dividendBytes: 2,
      divisorRegister: 0x804206,
      divisorBytes: 1,
    });
    divisions.push(currentDivision);
  };
  const resultRead = (part) => {
    const value = currentDivision[part];
    divisionReads.push(
      Object.freeze({
        division: divisions.length,
        address: part === 'quotient' ? 0x804214 : 0x804216,
        value,
      }),
    );
    return value;
  };
  let a = readWord(0x801d61);
  if (a === 0) return { outcome: 'af1f_zero', a, x, y, carry, overflow };
  a = readWord(0x7e2de6);
  if (a & 0x8000) return { outcome: 'af1f_negative', a, x, y, carry, overflow };
  if (divisionMode !== 'stable-native')
    throw { renderBoundary: true, reason: 'render_division_context_required', address: 0x81af32 };

  // Both source bytes are required before retaining only the low byte.
  divide(readWord(0x7e3c00) & 255);
  writeWord(0x7e241c, 0x6c04);
  writeWord(0x7e245c, 0x6c07);
  writeWord(0x7e249c, 0xec04);
  x = 20;
  y = resultRead('quotient');
  do {
    tick();
    firstVisits++;
    writeWord(0x7e2406 + x, 0x2c05);
    writeWord(0x7e2446 + x, 0x2c10);
    writeWord(0x7e2486 + x, 0xac05);
    x = (x - 2) & 0xffff;
    y = (y - 1) & 0xffff;
  } while (y !== 0);
  // Stable-native preserves the current arithmetic result until the next
  // division; reads occur here, after all preceding output writes.
  a = resultRead('remainder');
  writeWord(0x7e2406 + x, a ? 0x2c06 : 0x2c04);
  writeWord(0x7e2446 + x, a ? 0x2c15 : 0x2c07);
  writeWord(0x7e2486 + x, a ? 0xac06 : 0xac04);

  divide(readWord(0x7e3c00) & 255);
  x = readWord(0x8db8d2);
  a = readWord(0x7e0002 + x) & 255;
  writeWord(0xa8, a, false);
  a += 19;
  carry = 0;
  overflow = 0;
  y = resultRead('quotient');
  writeWord(0xa2, y, false);
  y = resultRead('remainder');
  writeWord(0xa5, y, false);
  if (y !== 0) {
    a -= 10;
    carry = 1;
  }
  divide(a);
  x = 20;
  const left = readWord(0xa2),
    right = resultRead('quotient');
  a = (left - right) & 0xffff;
  carry = Number(left >= right);
  overflow = (left ^ right) & (left ^ a) & 0x8000 ? 1 : 0;
  if (a !== 0) {
    y = a;
    do {
      tick();
      middleVisits++;
      a = 0x2c08;
      writeWord(0x7e2446 + x, a);
      x = (x - 2) & 0xffff;
      y = (y - 1) & 0xffff;
    } while (y !== 0);
  }
  y = readWord(0xa5);
  let tableWrite = true;
  if (y !== 0) {
    a = readWord(0xa8);
    carry = Number(a >= 11);
    if (a < 11) {
      a = resultRead('remainder') + 11;
      carry = 0;
      overflow = 0;
    } else a = resultRead('remainder');
  } else {
    a = readWord(0xa8);
    if (a === 0) tableWrite = false;
    else a = resultRead('remainder');
  }
  let tableOffset = null;
  if (tableWrite) {
    carry = a >>> 15;
    tableOffset = (a << 1) & 0xffff;
    a = readWord(0x81b026 + tableOffset);
    writeWord(0x7e2446 + x, a);
  }
  return {
    outcome: 'af1f_active',
    a,
    x,
    y,
    carry,
    overflow,
    firstVisits,
    middleVisits,
    wordWrites,
    tableOffset,
    divisions: Object.freeze(divisions),
    divisionReads: Object.freeze(divisionReads),
  };
}
