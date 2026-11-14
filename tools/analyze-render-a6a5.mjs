import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { formatBlock } from './disassemble.mjs';
import { proveRenderMenuSource } from './render-menu-source.mjs';
import { describeRenderDialogBlock as describe } from './render-dialog-source.mjs';
import { verifyMenuSourceReports } from './render-menu-source-reports.mjs';

const { bytes, metadata } = inspectRom(await readFile(process.argv[2] ?? 'Shadowrun (E).smc'));
if (metadata.rom_sha256 !== '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690') throw Error('Wrong European ROM revision');
const source = proveRenderMenuSource(bytes);
const {blocks, reused, reusedWindows, graphBlocks, map, proofs, menuMap, roots, seen, calls,
  menuDependencies, menuCallees, closedMap, menuProofs, originalMenuProofs, menuCodeBytes} = source;
await verifyMenuSourceReports([...source.dependencies, ...menuDependencies], metadata.rom_sha256);
const tables = [['selectedSoundC4FF', 0x80C4FF, 2]] .map(([name, entry, length]) => {
  const raw = bytes.subarray(cpuToOffset(entry, bytes.length), cpuToOffset(entry, bytes.length) + length);
  return { name, entry: cpuLabel(entry), covered_bytes: length, machine_bytes: raw.toString('hex').toUpperCase(),
    sha256: createHash('sha256').update(raw).digest('hex'), qualification: 'Selected original WORD for menuDP02=004C only, not complete audio loader or tablecapacity proof.' };
});
if (tables[0].machine_bytes !== '2D00') throw Error('Renew original menu sound');
const report = {
  rom_sha256: metadata.rom_sha256, progress_reference: 'docs/PORTIERUNGSSTAND.json', windows: blocks.map(describe), dependencies: [{ report: 'analysis/render-be6d.json', windows: reusedWindows }], tables,
  scope: 'Complete local A6A5/A6AD/A6B8/A6C7 and actual transitive render/audio/B0A1/9E1A bodies. Conditional normal-return byte-stack/mode/DBR graph closed for all four roots, original002D and all-WORD sound profiles. Native manual normal menu supplied separately; full reset, actual audio lifecycle and wait/input/interrupt ownership remain open. No CPU/device/clock/scene execution.',
  menu_dependencies: menuDependencies.map(({owner,...d}) => d),
  conditional_menu_graph: { code_bytes: menuCodeBytes, instructions: closedMap.size,
    proofs: menuProofs, original_sound_proofs: originalMenuProofs,
    full_reset_graph_closed: false, native_binding: true,
    native_entries: ['80:A6A5','80:A6AD','80:A6B8','80:A6C7'], actual_termination_proven: false },
  helper_graph: { code_bytes: graphBlocks.reduce((n, b) => n + describe(b).covered_bytes, 0), instructions: map.size,
    proofs, native_binding: true, native_entries: ['80:FAAC', '80:FD80', '80:A617', '80:A5DB', '80:A5F9'], external_return_assumptions: 0, actual_termination_proven: false },
  menu: { roots: roots.map(cpuLabel), reachable_local_instructions: seen.size, calls,
    returns: ['80:A825', '80:A834'], full_graph_closed: false, minimum_protected_stack_bytes: null,
    conditional_normal_graph_closed: true, conditional_minimum_protected_stack_bytes: menuProofs[0].minimum_protected_stack_bytes,
    qualification: 'All four normal-return roots close actual transitive callee bodies under explicit fresh9E1A not3030 and original caller nonzero-voice lemmas. Confirmation DBR80 and cancellation entryDBR remain distinct. Native manual normal menu supplied separately; full reset/termination remain open.' },
  contract: {
    entries: 'A6A5 sets1DA7=FFFF,1DA5=0,1D97=0; A6AD sets1DA5=FFFF,1DA7=0,1D97=0; A6B8 sets1D97=incomingA ASL WORDwrap then1DA5=FFFF,1DA7=0; A6C7 zeroes allthree. FreshDP02/04->1D99/1D9B;1D95/1DA1=0;A617 thenfresh1D97->Y/A5F9.',
    input: 'B0A1 waits for actual longWORD7E1C76 change, then9E1A may normalreturn orE382 reset. Freshedge01CE->1DA3, freshheld01CA&0C00 decidesINCWORD1DA1; exact20 resetscounter19 and replaces1DA3 withfreshheld. No directionalheld clearscounter. Exact20 only, not >=20 or time measurement; counterwrap retained.',
    navigation: 'Fresh01CE bit2000 cancels beforeD0C0 confirms. Fresh1DA3 bit0400 prioritizesnextitem, full1D97+2 then[08],Y zero gate; bit0800 selects previous ifcurrentindexnonzero.1DA7nonzero bypassespagebits. Pageback SEC with twoSBCDP06, second inherits firstborrow; pageforward starts1D95 and advancesY by2 in WORDX=DP06 do-loop with fresh[08],Y zeroterminator, no count0 shortcut.',
    scrolling: 'PHY savesselectedY. unsignedCPY1D95 choosespreviouspage; otherwise unsigned((Y-1D95)>>>1)>=DP06 choosesnextpage. Nextpage singleCLC with twoADCDP06, second inherits carry. Previouspage singleSEC twoSBCDP06, only finalborrow clamps0. Stores1D95 thenFA67/A617, restoresselectedY onlyafterthosecalls atA791. Freshold1D97->A5DB, restoredY->1D97/A5F9. PEIDP00/06 then literal parameterstores04=40,06=3,02=4A, but noC46E call; PLA restores06 then00.04/02 remain rewrites.',
    hotkeys: 'If1DA7 nonzero, scanY0..WORDwrap fresh[08],Y untilzero; fullDBR-relative(0C),Y ANDfresh01CE selectsfirstnonzero. PHYselectedY, freshold1D97/A5DB, PLA->1D97 thenconfirmationA805. No cached pointerbank/edge/wordlist and no inferred maximumitems.',
    exit: 'Confirmation A7FF clearsmark viaA5DB thenDP00=FFFF,04=40,06=3,02=4C/C46E; fresh1D97/LSR->DP00 then9E1A/RTS. Cancellation A826 clearsmark viaA5DB, DP00=FFFF then9E1A/RTS; noaudio call. Later9E1A and actualC46E DBR effects remain material; no automatic frame binding.',
    list: 'A617 fresh1D9B->1D9D,DP06->1D9F,1D95->Y. Each iteration fresh1D99->DP02,1D9D->DP04,INC1D9D,FAAC then fresh[08],Y. Zero exitsline loop immediately. Nonzero->DP02,PHY/FE69/PLY; fresh1DA5 optionally fresh(0C),Y nonzero then707D/FE69, freshnumber(0C),Y/FD80, eachwithPHY/PLY. INYtwice,DEC1D9F/BNE; count0 doesnot skipfirstiteration. Atlimit freshnexttoken nonzero renders707A atwidth/height minus3. Fresh1D95 nonzero renders7077 atwidthminus3,row0. Calls sharefreshDP00 and actualbuffers. No token/cache/rowcount caps.',
    marks: 'A5DB/A5F9 TYA/SEC/SBCfresh1D95/LSR/CLC/ADCfresh1D9B->DP04; fresh1D99 DEC->DP02;FAAC then707D or7074->DP02/FE69. Full wrapping calculation; FE69 may alterX/Y andscratch; sourcecaller savesY where needed.',
    faac: 'PHB/PEA8080/PLB/PLB setslocalDBR80. FullDP00->X. BYTEfreshDP04->4202, BYTEfreshlong7E2020+X minus2->4203. REP20/CLC/freshlong7E2060+X plusfreshDP02 thenfreshWORD804216, with carry inheritedbetweenADCs. ActualWORDpointer->long7E20C0+X,WORD0->7E20E0+X. RestoresDBR;A0,Xactualindex,Yretained,C/VlastADC,N/ZfromBYTEPLB. AlwaysactualexplicitMMIO result evenentryDBR7E/7F.',
    fd80: 'WORD0->long7E21A5/21A6, X5, freshWORDDP02. ActualDBR WORD4204 dividend/BYTE4206 divisor10, DEX,CLC/BYTE30+freshBYTE4216->long7E21A0+X, REP20/freshWORD4214; nonzero loopswithoutdigitcap/recomputation. Zero thenlocalDBR7E. X0 skipscopy; otherwiseY0/BYTEreadactual21A0+X/write21A0+Y, zero endsafterwrite, INX/INY wrapseparately whileaddressescarrybanks. REP20/FB39/restoreDBR. OriginaltwoBYTEterminators andhiddenhighA retained. Native boundaryrequiresdistinctWORDquotient/BYTEremainder observations; not geometryBYTE4214/WORD4216 lists.',
    audio_boundary: 'SelectedC46E startsPHK/PLB, forcesDBR80 withoutsave. PHA soundWORD precedes selectedC416,F007,F130 calls. ItsX=DP06 zero branch atC495 reachesRTSC4B2 withoutPLA; genericwholebodystackreturn cannotbeassumed. Complete transitiveC46E/C416/F130/F007 source, directoryownerF092 andselectedmenu8-byte proof supplied inrender-audio; menuDP06=3/originalC4FF002D skipF130 andpreservevoice. NativeC416 and all-WORD-sound/nonzero-voice C46E supplied separately; conditional14-byte plus low/cache-hit/menu8-byte proofs, one provider/budget/commit andglobal4217/2140 observations. Only unbalanced zero voice remains an atomicboundary; high sounds use original F130/cache gates. ActualAPU progress/boot/interrupt owners andwholemenu execution remainopen.',
  },
  next: 'Current next block and open work: docs/PORTIERUNGSSTAND.json.',
};
await writeFile('analysis/render-a6a5.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('analysis/render-a6a5.asm.txt', `; European ROM SHA-256 ${metadata.rom_sha256}\n; Complete local and transitive menu source2304/1088. Conditional normal graph20 stackbytes; fresh9E1A not3030, original caller voice3. Full reset and generic zero voice remain separate. No CPU execution.\n\n` + [...blocks, ...reused, ...menuCallees.filter(b => b.name !== 'audioC46E')].map(formatBlock).join('\n'));
console.log(`A6A5 local ${describe(blocks[0]).covered_bytes}/${menuMap.size}; conditional menu ${menuCodeBytes}/${closedMap.size}; stack ${menuProofs.map(p => p.minimum_protected_stack_bytes)}; native normal menu supplied; fullreset OPEN.`);
