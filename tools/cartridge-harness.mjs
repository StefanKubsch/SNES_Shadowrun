// Datenpaket statt ROM (docs/ROM-FREE.md): Die Livetests laufen wie das
// Produkt aus assets/vm-cartridge.*; ein Lesezugriff auf fehlenden Code
// endet als rom_byte_absent.
import {readFileSync} from 'node:fs';
import {loadCartridge} from '../src/data/cartridge.mjs';

export const readAsset = async name => new Uint8Array(readFileSync(new URL(`../assets/${name}`, import.meta.url)));
export const cartridge = await loadCartridge(readAsset);
