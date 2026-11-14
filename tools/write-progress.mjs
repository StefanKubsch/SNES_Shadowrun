import { writeFile } from 'node:fs/promises';
import { readProgress, progressReference } from './progress.mjs';
const progress = await readProgress(process.cwd());
const text = `# Zentraler Portierungsstand\n\n<!-- Erzeugt durch npm run docs:progress aus ${progressReference}. Nur JSON bearbeiten. -->\n\n`
  + `${progress.scope}\n\n`
  + (progress.autonomous_batch?`Autonomer Auftrag: **${progress.autonomous_batch.completed_groups.length}/${progress.autonomous_batch.authorized_blocks} Blöcke abgeschlossen**. ${progress.autonomous_batch.authorization}\n\n`:'')
  + `Nächster Block: **${progress.next_block.entries.join(', ')} – ${progress.next_block.kind}**. ${progress.next_block.objective}\n\n`
  + `## Gelieferte manuelle Bausteine dieses Zweigs\n\n| Eintritt | Quelle | Natives Modul | Geschützte Stackbytes |\n|---|---|---|---:|\n`
  + progress.supplied.map(r => `|${r.entry}|[Quellbericht](../${r.source})|[Modul](../${r.native})|${r.stack_bytes}|`).join('\n')
  + `\n\n## Geplante Arbeitsgruppen\n\nDie Aufnahme in [dialog-936c-inventory.json](../analysis/dialog-936c-inventory.json) ist eine bedingte lokale Call-Inventur, kein geschlossener Quellen-/Rückkehrbeweis.\n\n`
  + progress.work_groups.map(g => `- **${g.id}** (${g.entries.join(', ')}): ${g.reason}`).join('\n')
  + `\n\n## Manuelle native Taskpraefixe\n\nDiese Bindungen verwenden explizite physische Quellen und eingefrorene Kontexte. Dynamischer Folgedispatch und gesamte Task-/Framekomposition bleiben offen.\n\n`
  + progress.work_groups.filter(g=>g.manual_native).map(g=>`- **${g.id}**: [Modul](../${g.manual_native.module}), [gepruefter manueller Bericht](../${g.manual_native.report}).`).join('\n')
  + `\n\n## Eigene Taskadapter fuer gelieferte Renderroots\n\nSeparate volle Taskadapter erhalten die vorhandenen Rendervertraege und pruefen eigene echte Stackstores. Native58-/Originalbody-/ganzeTask-/Framebindung bleibt separat.\n\n`
  + progress.work_groups.flatMap(g=>g.render_adapter_blocks??[]).map(b=>`- **${b.id}** (${b.entries.join(', ')}): [Quelle](../${b.source_contract}), [Modul](../${b.manual_native.module}), [gepruefter Bericht](../${b.manual_native.report}). ${b.reason}`).join('\n')
  + `\n\n## Begrenzte Visit-/Opcode-Rueckkehrkompositionen\n\nEchte innere Returnbytes verbinden F378/F390 mit END56 oder Script52-Yield und C20B; C1D9 restauriert den Cursor und liest den geschuetzten Rootreturn. Weitere Opcodezahl, Quellen und kompatible Eintritte bleiben explizit.\n\n`
  + progress.work_groups.flatMap(g=>g.composition_blocks??[]).map(b=>`- **${b.id}** (${b.entries.join(', ')}): [Quelle](../${b.source_contract}), [Modul](../${b.manual_native.module}), [gepruefter Bericht](../${b.manual_native.report}).`).join('\n')
  + `\n\n## Einzeln gepruefte Opcodekompositionen\n\nJede Tabellenbindung besitzt einen Quellen- und einen Nativeblock. Gemeinsamer Eintritt F390; bestehende Handler bleiben separate lokale Vertraege.\n\n| Opcode | Handler | Quelle | Native Komposition |\n|---|---|---|---|\n`
  + progress.work_groups.flatMap(g=>g.dispatch_blocks??[]).map(b=>`|${b.opcode.toString(16).padStart(2,'0').toUpperCase()}|${b.handler}|[Vertrag](../${b.source_contract})|[Bericht](../${b.manual_native.report})|`).join('\n')
  + `\n\n## Vollstaendige begrenzte Native58-Kompositionen\n\nSeparater Eintritt F390: Argumentpraefix, echte Stackbruecke, frisches A2, belegter Leaf/RTS und Resume bis F390 auf einem Overlay. Quelle und native Bindung separat geprueft. Kein ganzer Task-/Szenen-/Framebeweis.\n\n| Original-ID | Callee | Quelle | Native Komposition |\n|---|---|---|---|\n`
  + progress.work_groups.flatMap(g=>g.native58_blocks??[]).map(b=>`|${b.native_function_id??'gemeinsam'}|${b.callee??'59 einzeln belegte Ziele'}|[Vertrag](../${b.source_contract})|[Bericht](../${b.manual_native.report})|`).join('\n')
  + `\n\n## Begrenzte Script52-Kompositionen\n\nOriginalargumente, echte Heap-/Frameerzeugung und Child-Insertion bis zum aeusseren Yield. F495 ist ein separat beobachteter spaeterer Einstieg; Scriptbody, C1CA-Readiness und zeitlicher Lifecycle bleiben offen.\n\n| Original-ID | Frameheader | Quelle | Native Komposition |\n|---|---|---|---|\n`
  + progress.work_groups.flatMap(g=>g.script52_blocks??[]).map(b=>`|${b.script_id??'gemeinsam'}|${b.script_header??'explizite Providerbytes'}|[Vertrag](../${b.source_contract})|[Bericht](../${b.manual_native.report})|`).join('\n')
  + `\n\n## Gemeinsam gelieferte Originalscriptbodies\n\nIndividuelle Originalbytes und Bodypfade mit gemeinsam erneuerten Handlerbeweisen. Beobachteter erster F390-Eintritt und END-Rueckkehr; weitere Initialisierung, Caller und Szenen bleiben getrennt.\n\n`
  + progress.work_groups.flatMap(g=>g.script_body_batches??[]).map(b=>`- **${b.id}** (${b.script_ids.length} Bodies): [Quelle](../${b.source_contract}), [gemeinsames Modul](../${b.manual_native.module}), [kompakter Bericht](../${b.manual_native.report}).`).join('\n')
  + `\n\n## Getrennte offene Grenzen\n\n` + progress.open_boundaries.map(b => `- **${b.id}**: ${b.description}`).join('\n')
  + `\n\n## Arbeitsablauf\n\n${progress.workflow.focused}\n\nLieferprüfung: \`${progress.workflow.release_command}\`. Sie erzeugt zwei vollständige Render-/Plan-/Dokumentationsdurchläufe, vergleicht Artefakte, prüft beide AC-Quellen, Syntax, sämtliche Tests, Diff und LFS. Logs und eine JSON-Zusammenfassung liegen außerhalb des Repositorys im temporären Verzeichnis.\n\n${progress.workflow.delivery}\n\nRoutinespezifische Quellverträge stehen weiterhin in den jeweiligen Dokumenten. Historische Prüfstände bleiben historische Nachweise; die aktuelle Arbeitsreihenfolge wird ausschließlich im JSON gepflegt.\n`;
await writeFile('docs/PORTIERUNGSSTAND.md',text);
console.log('Zentraler Fortschrittsstand aus geprüften Quellen erzeugt.');
