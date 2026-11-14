-- Mesen2-Rekorder für den Orakelvergleich (nur Testwerkzeug, nie Teil von src/).
-- Parameter werden von tools/mesen.mjs vor den Start gesetzt:
--   START_FRAME, END_FRAME, INPUT_PERIOD, INPUT_HOLD: A+Start alle INPUT_PERIOD Frames für INPUT_HOLD Frames
--   WALK_FROM, WALK_STEP: ab Frame WALK_FROM (0 = nie) statt dessen das Steuerkreuz,
--                         rechts, unten, Pause, links, oben, Pause je WALK_STEP Frames
--   PLAN_FROM, PLAN:      ab Frame PLAN_FROM (0 = nie) eine Befehlsfolge, danach keine Taste:
--                         {"hold", tasten, n}  Tasten n Frames halten ("left+b")
--                         {"press", tasten, n} 6 Frames drücken, bis Frame n des Befehls warten
--                         {"wait", n}          n Frames ohne Taste
--                         {"glove", x, y}      Handschuh/Cursor ($01D4/$01D6, High-Byte) im
--                                              Regelkreis per Steuerkreuz auf Bildpixel x/y
--                         {"aim", id, xadr, yadr, dx, dy} Handschuh auf Wort(xadr)/4 + dx,
--                                              Wort(yadr)/4 + dy (Objektposition), höchstens 120 Frames
-- Ausgabe auf stdout, eine Zeile je Ereignis:
--   W <hex>                 WRAM beim ersten $F390 im Fenster (131072 Bytes)
--   M <hex>                 SRAM zur selben Zeit (8192 Bytes)
--   S <regs> [w <off>=<v>..] Register bei $F390 und die WRAM-Schreibzugriffe seit dem
--                           letzten S in Reihenfolge, "!" davor = im NMI-Handler ($C112 bis RTI $C14E),
--                           "S" davor = SRAM-Offset (Speichern);
--                           "i" markiert NMI/IRQ, "u" einen nicht abbildbaren Write,
--                           "r <adr>=<v>@<pc>" Lesezugriffe auf Hardwareregister ($2100-$21FF, $4200-$43FF),
--                           nur außerhalb des NMI-Handlers
--                           "q .." Beobachtungen in Ausführungsreihenfolge, nur außerhalb des NMI-Handlers:
--                           "b<v>"      Zähler $7E1C76, zuletzt gelesen vom CMP an $81:B0A5, beim RTL $B0AB
--                           "z<pc>=<v>@<dbr>" Austrittswert einer Warteschleife aus WAIT_LOOPS (LDA abs, Bxx auf sich)
--                           "j<v>@<dbr>" Joypadwort $01CA beim Eintritt in $80:9E1A
--                           "n<pc>:<off>=<v>" vom NMI geschriebenes Wort, das der Code nach dem Warten an <pc>
--                                       liest (Auftragsliste: $0082 nach $AE0C/$AE5E und nach B0A1 aus $AE23;
--                                       VRAM-Lesen über $01FC: $2AE0-$2AEE nach $81:ACC9)
--   C <regs> @<pc> [..]    wie S, am JSR auf eine Schedulerrunde ($C1E3/$C1CA)
--   R <regs> @<pc> [..]    wie S, an der Rückkehr aus dieser Schedulerrunde (gleicher Stapelzeiger wie
--                           beim C; $91D7 ist auch das normale RTS von $9178 und zählt dann nicht)
--   E [w ..]                Schreibzugriffe nach dem letzten S
--   D <hex>                 WRAM am Ende (Selbstprüfung der Rekonstruktion)
--   N <zahl>                Zahl aller Zeilen davor
-- Jede Zeile außer N endet mit " #<laufende Nummer>"; der Aufrufer erkennt verlorene, doppelte
-- oder zerrissene Ausgabe und Zeilen nach dem Abschluss.
local frames, recording, started, done = 0, false, false, false
local writes, reads, interrupted, unknown, inNmi = {}, {}, false, false, false
local queue, rounds = {}, {}
local printed = 0
-- Nach dem Abschluss (D, N) nichts mehr: emu.stop wirkt nicht sofort, unter Last liefen danach noch Frames.
local function out(line) if done then return end printed = printed + 1 print(line .. " #" .. printed) end

local function wram(address)
  local bank, offset = address >> 16, address & 0xFFFF
  if bank == 0x7E or bank == 0x7F then return address - 0x7E0000 end
  if (bank & 0x40) == 0 and offset < 0x2000 then return offset end
  return nil
end

local function dump(tag, memType, size)
  local parts = {}
  for a = 0, size - 1 do parts[#parts + 1] = string.format("%02x", emu.read(a, memType)) end
  out(tag .. " " .. table.concat(parts))
end

-- Teure Rückrufe (jeder WRAM-Schreibzugriff, Gerätelesungen, Warteschleifen) erst ab Aufnahmebeginn
-- registrieren (arm); vorher kosten sie bei langen Wegen den größten Teil der Laufzeit des Testrunners.
local armers = {}
local function arm() for _, register in ipairs(armers) do register() end end
armers[#armers + 1] = function()
  emu.addMemoryCallback(function(address, value)
    if not started then return end
    local offset = wram(address)
    if offset == nil then unknown = true return end
    writes[#writes + 1] = string.format(inNmi and "!%x=%x" or "%x=%x", offset, value)
  end, emu.callbackType.write, 0, 0x1FFFF, emu.cpuType.snes, emu.memType.snesWorkRam)
  -- SRAM (Speichern über $81:B17D): Offset mit "S" davor in derselben Schreibfolge.
  emu.addMemoryCallback(function(address, value)
    if started then writes[#writes + 1] = string.format("S%x=%x", address & 0x1FFF, value) end
  end, emu.callbackType.write, 0, 0x1FFF, emu.cpuType.snes, emu.memType.snesSaveRam)
end

-- PC zeigt beim Datenzugriff hinter die Operanden; der Vergleich bestimmt daraus den Befehl.
local function onIoRead(address, value)
  if not started or inNmi then return end
  local s = emu.getState()
  reads[#reads + 1] = string.format("%x=%x@%x", address, value, (s["cpu.k"] << 16) | s["cpu.pc"])
end
armers[#armers + 1] = function()
  for _, bank in ipairs({0x800000, 0}) do
    for _, range in ipairs({{0x2100, 0x21FF}, {0x4200, 0x43FF}}) do
      emu.addMemoryCallback(onIoRead, emu.callbackType.read, bank + range[1], bank + range[2], emu.cpuType.snes, emu.memType.snesMemory)
    end
  end
end
local function syncPoint(tag, pc)
  if not recording then return end
  if not started then
    if tag ~= "S" then return end
    dump("W", emu.memType.snesWorkRam, 0x20000); dump("M", emu.memType.snesSaveRam, 0x2000); started = true
  end
  local s = emu.getState()
  local line = string.format("%s %x %x %x %x %x %x %x %x %d", tag, s["cpu.a"], s["cpu.x"], s["cpu.y"], s["cpu.sp"],
    s["cpu.d"], s["cpu.dbr"], s["cpu.ps"], s["cpu.k"], frames)
  if pc then line = line .. string.format(" @%x", pc) end
  if interrupted then line = line .. " i" end
  if unknown then line = line .. " u" end
  if #reads > 0 then line = line .. " r " .. table.concat(reads, " ") end
  if #writes > 0 then line = line .. " w " .. table.concat(writes, " ") end
  if #queue > 0 then line = line .. " q " .. table.concat(queue, " ") end
  out(line)
  writes, reads, interrupted, unknown, queue = {}, {}, false, false, {}
end
armers[#armers + 1] = function()
  for _, bank in ipairs({0x800000, 0}) do
    emu.addMemoryCallback(function() syncPoint("S") end, emu.callbackType.exec, bank + 0xF390, bank + 0xF390)
  end
end
for _, bank in ipairs({0x800000, 0}) do
  -- JSR $C1E3 ($96C0) und JSR $C1CA ($91D4, $E545, $E78E) sowie die Rücksprungstellen.
  -- R nur bei dem Stapelzeiger des zugehörigen C (der JSR legt dazwischen zwei Bytes ab und nimmt sie zurück).
  for _, pc in ipairs({0x96C0, 0x91D4, 0xE545, 0xE78E}) do
    emu.addMemoryCallback(function()
      -- auch vor Aufnahmebeginn: eine Runde kann vor dem ersten S beginnen und danach enden
      rounds[pc] = rounds[pc] or {}
      table.insert(rounds[pc], emu.getState()["cpu.sp"])
      syncPoint("C", pc)
    end, emu.callbackType.exec, bank + pc, bank + pc)
    emu.addMemoryCallback(function()
      local open = rounds[pc]
      if open and #open > 0 and open[#open] == emu.getState()["cpu.sp"] then
        table.remove(open)
        syncPoint("R", pc + 3)
      end
    end, emu.callbackType.exec, bank + pc + 3, bank + pc + 3)
  end
end

-- Beobachtungen für Spezialnatives, die vom NMI geschriebenes WRAM lesen (Abschnitt "q").
local function wramWord(offset) return emu.read(offset, emu.memType.snesWorkRam) | (emu.read(offset + 1, emu.memType.snesWorkRam) << 8) end
local function observe(entry) if started and not inNmi then queue[#queue + 1] = entry end end
-- emu.getState() ist teuer; in Schleifen nur Speicherlesungen. Der Zähler wird beim Lesen gemerkt
-- (der CMP an $B0A5 ist die letzte Lesung vor dem RTL) und beim RTL ausgegeben.
local counter = {0, 0}
armers[#armers + 1] = function()
  emu.addMemoryCallback(function(address, value)
    if not inNmi then counter[(address & 0xFFFF) - 0x1C76 + 1] = value end
  end, emu.callbackType.read, 0x1C76, 0x1C77, emu.cpuType.snes, emu.memType.snesWorkRam)
  for _, bank in ipairs({0x800000, 0}) do
    emu.addMemoryCallback(function()
      observe(string.format("b%x", counter[1] | (counter[2] << 8)))
      -- Rücksprung nach $80:AE27 (JSL bei $AE23): Kachelschleife liest danach $0082 und $1562.
      local sp = emu.getState()["cpu.sp"]
      local raw = emu.read(sp + 1, emu.memType.snesMemory) | (emu.read(sp + 2, emu.memType.snesMemory) << 8)
      if raw == 0xAE26 and emu.read(sp + 3, emu.memType.snesMemory) == 0x80 then
        observe(string.format("n80ae23:82=%x", wramWord(0x82)))
        observe(string.format("n80ae23:1562=%x", wramWord(0x1562)))
      end
    end, emu.callbackType.exec, bank + 0x1B0AB, bank + 0x1B0AB)
    emu.addMemoryCallback(function()
      observe(string.format("j%x@%x", wramWord(0x1CA), emu.getState()["cpu.dbr"]))
    end, emu.callbackType.exec, bank + 0x9E1A, bank + 0x9E1A)
    for _, loop in ipairs(WAIT_LOOPS) do
      local pc, offset, exitNegative, extras = loop[1], loop[2], loop[3] == 1, loop[4]
      emu.addMemoryCallback(function()
        local value = wramWord(offset)
        local exits = exitNegative and value >= 0x8000 or (not exitNegative and value == 0)
        if exits then
          observe(string.format("z%x=%x@%x", pc, value, emu.getState()["cpu.dbr"]))
          for _, extra in ipairs(extras) do observe(string.format("n%x:%x=%x", pc, extra, wramWord(extra))) end
        end
      end, emu.callbackType.exec, bank + (pc & 0x7FFFFF), bank + (pc & 0x7FFFFF))
    end
  end
end
-- Die CPU legt vor dem Handler den Interruptrahmen (PB, PCH, PCL, P) auf den laufenden Stapel;
-- diese vier Schreibzugriffe liegen vor dem NMI-Ereignis und werden hier nachträglich markiert.
local function markInterruptFrame()
  local n = #writes
  if n < 4 then return end
  local offsets = {}
  for i = n - 3, n do offsets[#offsets + 1] = tonumber(writes[i]:match("^!?(%x+)="), 16) end
  for i = 2, 4 do if offsets[i] ~= offsets[i - 1] - 1 then return end end
  for i = n - 3, n do if writes[i]:sub(1, 1) ~= "!" then writes[i] = "!" .. writes[i] end end
end
emu.addEventCallback(function() interrupted = true; inNmi = true; markInterruptFrame() end, emu.eventType.nmi)
for _, bank in ipairs({0x800000, 0}) do
  emu.addMemoryCallback(function() inNmi = false end, emu.callbackType.exec, bank + 0xC14E, bank + 0xC14E)
end
emu.addEventCallback(function() interrupted = true end, emu.eventType.irq)

local planIndex, planStart = 1, nil
local function keys(text)
  local result = {}
  for key in string.gmatch(text, "[^+]+") do result[key] = true end
  return result
end
local function cursor(address) return emu.read(address + 1, emu.memType.snesWorkRam) end
-- Eingabe des aktuellen Planbefehls; true, wenn der Befehl danach erledigt ist.
local function planInput()
  local command = PLAN[planIndex]
  if command == nil then return {}, false end
  planStart = planStart or frames
  local t, kind = frames - planStart, command[1]
  if kind == "hold" then return t < command[3] and keys(command[2]) or {}, t + 1 >= command[3] end
  if kind == "press" then return t < 6 and keys(command[2]) or {}, t + 1 >= (command[3] or 12) end
  if kind == "wait" then return {}, t + 1 >= command[2] end
  if kind == "glove" or kind == "aim" then
    local tx, ty = command[2], command[3]
    if kind == "aim" then
      local function word(address) return emu.read(address, emu.memType.snesWorkRam) | (emu.read(address + 1, emu.memType.snesWorkRam) << 8) end
      tx, ty = ((word(command[3]) >> 2) + command[5]) & 0xFF, ((word(command[4]) >> 2) + command[6]) & 0xFF
    end
    local x, y, input = cursor(0x1D4), cursor(0x1D6), {}
    if math.abs(x - tx) <= 1 and math.abs(y - ty) <= 1 then return input, true end
    if kind == "aim" and t > 120 then return input, true end
    if t > 600 then error("glove target not reached") end
    if x < tx - 1 then input.right = true elseif x > tx + 1 then input.left = true end
    if y < ty - 1 then input.down = true elseif y > ty + 1 then input.up = true end
    return input, false
  end
  error("unknown plan command " .. tostring(kind))
end

emu.addEventCallback(function()
  if PLAN_FROM > 0 and frames >= PLAN_FROM then
    local input, finished = planInput()
    emu.setInput(input, 0)
    if finished then planIndex, planStart = planIndex + 1, nil end
    return
  end
  if WALK_FROM > 0 and frames >= WALK_FROM then
    local direction = ({"right", "down", false, "left", "up", false})[((frames - WALK_FROM) // WALK_STEP) % 6 + 1]
    emu.setInput(direction and {[direction] = true} or {}, 0)
    return
  end
  local press = (frames % INPUT_PERIOD) < INPUT_HOLD
  emu.setInput({start = press, a = press}, 0)
end, emu.eventType.inputPolled)

emu.addEventCallback(function()
  frames = frames + 1
  if frames == START_FRAME then arm(); recording = true end
  if frames == END_FRAME and not done then
    if started then
      out("E" .. (unknown and " u" or "") .. (#writes > 0 and (" w " .. table.concat(writes, " ")) or ""))
      dump("D", emu.memType.snesWorkRam, 0x20000)
      print("N " .. printed)
    end
    done = true
    emu.stop(0)
  end
end, emu.eventType.endFrame)
