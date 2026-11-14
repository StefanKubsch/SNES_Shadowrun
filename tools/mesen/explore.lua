-- Exploration in Mesen2 (tool only, never part of src/). Parameters from tools/mesen-explore.mjs:
--   START (frame from which the commands run; before it A+Start every 120 frames as in the recorder),
--   LIMIT (last frame), CMDS (command list)
-- Commands:
--   {"hold", keys, n}        hold the keys for n frames ("left+b")
--   {"press", keys, n, r}    press for 6 frames, wait until frame n of the command (default 12); with r the
--                            command ends instead after 6 frames and r main loop returns 80:96C3 (as in
--                            tools/live-plan-driver.mjs, so that lag frames do not shift the plan)
--   {"wait", n, r}           n frames without a key, or r main loop returns with r
--   {"glove", x, y}          steer the glove ($01D4/$01D6, high byte = screen pixel) in a control loop
--   {"seek", id, x0, y0, x1, y1} walk a grid (4 px) until object id is under the glove
--   {"scan", x0, y0, x1, y1, step} walk a grid and report every object change (room map)
--   {"shot", name}           screenshot
--   {"watch", adr, ...}      from now on every 4 frames "W frame x y word..." (WRAM words, glove x y)
--   {"track", n}             from now on every n frames "P frame x y" (player: slot $0CC2, x $0E28+slot, y $0E80+slot, divided by 4)
--   {"verbose"}              from now on report every native call and every new task (uses no frame)
--   {"poke", adr, value, 1}  set a WRAM word (byte with 1), for coverage measurement only (uses no frame)
--   {"matrix", c, entry, d, a} the writes of native 7D (80:E30F) for Jake: 1CE9 = FFFE, 7E:2DE2 = entry,
--                            1D8D = 40, 1D8F = c, 1D8E = d, 1D90 = a, 1D8C = record byte 9 (7E:3C04), and
--                            1D93/1D8B from Jake's state record (13A8 of slot 0CC2); coverage only (uses no frame)
--   {"redirect", entry}      the next room change 80:A4BF goes to this entry of the room table 8D:929D
--                            instead (A on entry), for coverage measurement only (uses no frame)
--   {"vramwatch"}            from now on report VRAM data writes (2118/2119) per frame as "V frame active total
--                            first-scanline pc first-any-scanline first-any-pc": active counts writes in active display
--                            with the display on (no frame)
--   {"readwatch", from, to, ...} from now on report CPU reads in these address ranges as "RD frame address value pc"
--   {"until", adr, value}    wait until the WRAM word at adr equals value (at most 3000 frames)
--   {"counter", seed}        from now on every read of 213C/213D returns the next byte of xorshift32(seed),
--                            the counter replacement of the native port (src/vm/frame-events.mjs
--                            counterBytes), so that the random 80:C560 draws the same bytes (uses no frame)
--   {"clock", value}         from now on the random 80:C560 reads the frame counter 7E:1C76/1C77 (80:C56C, 80:C579)
--                            as value plus the NMIs since then that came in a blocking wait loop: the frame count of
--                            the lag-free native port, which has an NMI only there (LOOPS as alignLiveNmis in
--                            tools/mesen-live-room.mjs); lag frames of the original do not count (uses no frame)
--   {"mark"}, {"rewind"}     save the state, load it again (both at the next main loop round, coverage only)
--   {"tour", n, entry, ...}  at the next room change save the state, then for each entry load it, redirect
--                            to the entry and run n frames without a key ("TOUR frame entry" per entry)
--   {"scripts", n, id, ...}  the same at the next task creation 80:C2C8: X = each script ID in turn
--   {"tourplay", n, entry, ...} like tour, but each entry gets a fixed pseudo-random run of directions and
--                            A, B, Y, R, Start (seeded by the entry) once the commands are done
--   {"aim", id, xadr, yadr, dx, dy} steer the glove onto the object: target = word(xadr)/4 + dx, word(yadr)/4 + dy
--   {"sram", name}           print the save game (8 KiB SRAM) as "SRAM name hex"
--   {"walk", keys, x, y}     steer the player exactly to x, y; {"exit", keys} keys until a position jump above 32
--                            (like the closed live plans, tools/live-plan-driver.mjs)
--   {"profile", n}           n frames without a key; every executed instruction address in banks 80/81 outside the
--                            scheduler round (between JSR $C1E3 at $96C0 and the return at $96C3) as "X adr count"
-- Output: "N frame target slot dp00 dp02" first occurrence of a native (and every scene start $A1E6/$DE7E and dialog $936C;
-- slot = running task $0250), "T frame script slot" first task of a script ($C2C8, slot = head of the free list),
-- "O frame x y object|none" object change under the glove ($01DA >= 0, number $01DE),
-- "PNG name hex", "C frame x y" glove at the screenshot, "SEEK ...", "R frame old new" redirected room change,
-- "TOUR frame entry" a tour entry starts, "XT entry offset ps e" an instruction start first seen during that
-- entry, "RESET frame" a halted CPU reset for the next load, "XC offset ps e" and "XR offset pc" (COVER = 1:
-- instruction starts and data reads in banks 80/81), "END frame".
local frames, index, started = 0, 1, nil
local rounds, startRounds = 0, 0
local seen, lastObject, watch, verbose, track = {}, nil, nil, false, nil
local profiling, inRound, profile = false, false, {}
local function word(address) return emu.read(address, emu.memType.snesWorkRam) | (emu.read(address + 1, emu.memType.snesWorkRam) << 8) end
local function keys(text) local result = {} for key in string.gmatch(text, "[^+]+") do result[key] = true end return result end
local function glove() return word(0x1D4) >> 8, word(0x1D6) >> 8 end
local function steer(input, tx, ty)
  local x, y = glove()
  if math.abs(x - tx) <= 1 and math.abs(y - ty) <= 1 then return true end
  if x < tx - 1 then input.right = true elseif x > tx + 1 then input.left = true end
  if y < ty - 1 then input.down = true elseif y > ty + 1 then input.up = true end
  return false
end
-- Player and world axes as LIVE_PLAN in trace-live-room.lua: up+left +x, down+right -x, up+right +y, down+left -y.
local function player()
  local slot = word(0xCC2)
  if slot >= 0x8000 then return nil end
  return {word(0xE28 + slot) >> 2, word(0xE80 + slot) >> 2}
end
local STEER = {"down", "down+right", "right", "down+left", "", "up+right", "left", "up+left", "up"}
local function tagged()return (word(0x1DA) & 0x8000) == 0 and word(0x1DE) or nil end
local function raster(c, x0, y0, x1, y1, step)
  if c.points then return end
  c.points, c.at, c.still = {}, 1, 0
  local row = 0
  for y = y0, y1, step do
    local line = {}
    for x = x0, x1, step do line[#line + 1] = {x, y} end
    if row % 2 == 1 then for i = #line, 1, -1 do c.points[#c.points + 1] = line[i] end
    else for i = 1, #line do c.points[#c.points + 1] = line[i] end end
    row = row + 1
  end
end
-- Grid command: steer to the point, hold still for 8 frames (only then the game shows the object), continue.
local function walkRaster(c, input, found)
  local target = c.points[c.at]
  if target == nil then return true end
  if steer(input, target[1], target[2]) then
    c.still = c.still + 1
    if c.still >= 8 then
      if found and found() then return true end
      c.at, c.still = c.at + 1, 0
    end
  else c.still = 0 end
  return false
end

-- New script task ($C2C8, X = script ID): first occurrence per script as "T frame script".
local scripts = {}
for _, bank in ipairs({0x800000, 0}) do
  emu.addMemoryCallback(function()
    local id = emu.getState()["cpu.x"]
    if frames >= START and (not scripts[id] or verbose) then print(string.format("T %d %03x %02x", frames, id, word(0x24E))) end
    scripts[id] = true
  end, emu.callbackType.exec, bank + 0xC2C8, bank + 0xC2C8)
end

for _, bank in ipairs({0x800000, 0}) do
  emu.addMemoryCallback(function()
    local target = word(0xA2)
    if frames >= START and (not seen[target] or target == 0xA1E6 or target == 0xDE7E or target == 0x936C or verbose) then
      print(string.format("N %d %04x %02x %04x %04x", frames, target, word(0x250), word(0), word(2)))
    end
    seen[target] = true
  end, emu.callbackType.exec, bank + 0xF52F, bank + 0xF52F)
end

-- Room change 80:A4BF with A = entry of the room table: a pending "redirect" replaces A once.
local redirect, tour, snapshot = nil, nil, {}
-- Coverage per tour entry: instruction starts first seen while an entry runs, printed as
-- "XT entry offset ps e" before the next entry starts (cover holds the states).
local segment, cover, coverReads = {}, {}, {}
local function flushSegment()
  if not (tour and tour.current) then return end
  for _, offset in ipairs(segment) do print(string.format("XT %04x %05x %s", tour.current, offset, cover[offset])) end
  segment = {}
end
for _, bank in ipairs({0x800000, 0}) do
  emu.addMemoryCallback(function()
    if tour and tour.kind == "room" and tour.at <= #tour.entries then
      if tour.state == nil then tour.state = emu.createSavestate() end
      if tour.armed then redirect, tour.armed, tour.left, tour.current = tour.entries[tour.at], false, tour.frames, tour.entries[tour.at]
        print(string.format("TOUR %d %04x", frames, redirect)) end
    end
    if redirect == nil then return end
    local s = emu.getState()
    print(string.format("R %d %04x %04x", frames, s["cpu.a"], redirect))
    s["cpu.a"] = redirect
    emu.setState(s)
    redirect = nil
  end, emu.callbackType.exec, bank + 0xA4BF, bank + 0xA4BF)
end

-- Script tour: the first task creation 80:C2C8 saves the state and gets X = the first script ID.
for _, bank in ipairs({0x800000, 0}) do
  emu.addMemoryCallback(function()
    if not (tour and tour.kind == "script" and tour.armed and tour.state == nil) then return end
    tour.state = emu.createSavestate()
    local s = emu.getState()
    s["cpu.x"] = tour.entries[1]
    emu.setState(s)
    tour.armed, tour.left, tour.current = false, tour.frames, tour.entries[1]
    print(string.format("TOUR %d %04x", frames, tour.entries[1]))
  end, emu.callbackType.exec, bank + 0xC2C8, bank + 0xC2C8)
end

-- State loads and saves for mark, rewind and the tours. Mesen does this only from an exec callback,
-- so it runs at the main loop round 80:96C0 and at the NMI entry 80:C112 (also when the main loop hangs).
local function serviceStates()
  if snapshot.want == "mark" then snapshot.state, snapshot.want = emu.createSavestate(), nil snapshot.cmd.done = true end
  if snapshot.want == "rewind" then snapshot.want = nil emu.loadSavestate(snapshot.state) snapshot.cmd.done = true end
  if tour and tour.load then
    -- The restored state stands on the tour's hook (A4BF or C2C8), whose exec callback does not
    -- fire again: set A or X here.
    flushSegment()
    tour.load, tour.armed, tour.left, tour.current = false, false, tour.frames, tour.entries[tour.at]
    emu.loadSavestate(tour.state)
    local s = emu.getState()
    s[tour.kind == "room" and "cpu.a" or "cpu.x"] = tour.entries[tour.at]
    emu.setState(s)
    print(string.format("TOUR %d %04x", frames, tour.entries[tour.at]))
  end
end
for _, bank in ipairs({0x800000, 0}) do
  emu.addMemoryCallback(serviceStates, emu.callbackType.exec, bank + 0xC112, bank + 0xC112)
end
-- A script run with foreign arguments can send the CPU into WRAM, where neither the main loop nor
-- the NMI runs any more: a pending load is then served from the next instruction there.
local function statePending() return snapshot.want ~= nil or (tour ~= nil and tour.load == true) end
emu.addMemoryCallback(function() if statePending() then serviceStates() end end, emu.callbackType.exec, 0x7E0000, 0x7FFFFF)
emu.addMemoryCallback(function() if statePending() then serviceStates() end end, emu.callbackType.exec, 0x000000, 0x001FFF)

-- Main loop profile: instruction addresses outside the round $C1E3 (NMI code included).
for _, bank in ipairs({0x800000, 0}) do
  emu.addMemoryCallback(function()
    inRound = true
    serviceStates()
  end, emu.callbackType.exec, bank + 0x96C0, bank + 0x96C0)
  emu.addMemoryCallback(function() inRound = false rounds = rounds + 1 end, emu.callbackType.exec, bank + 0x96C3, bank + 0x96C3)
end
local function profileExec(address)
  if profiling and not inRound then profile[address] = (profile[address] or 0) + 1 end
end
-- Registered only at the first "profile": a callback per instruction slows the run down a lot.
local profileArmed = false
local function armProfile()
  if profileArmed then return end
  profileArmed = true
  for _, bank in ipairs({0x800000, 0}) do
    emu.addMemoryCallback(function(address) profileExec(0x800000 | (address & 0xFFFF)) end, emu.callbackType.exec, bank + 0x8000, bank + 0xFFFF)
    emu.addMemoryCallback(function(address) profileExec(0x810000 | (address & 0xFFFF)) end, emu.callbackType.exec, bank + 0x18000, bank + 0x1FFFF)
  end
end

-- Code coverage (COVER = 1, docs/ROM-FREE.md): every instruction start in the ROM executed from frame 0
-- (LoROM upper halves of banks $00-$3F and $80-$BF) with its state the first time, at the end as "XC offset ps e".
if COVER == 1 then
  local function coverExec(address)
    if statePending() then serviceStates() end
    if (address & 0x8000) == 0 then return end
    local offset = ((address >> 16) & 0x1F) << 15 | (address & 0x7FFF)
    if cover[offset] == nil then
      local s = emu.getState()
      cover[offset] = string.format("%02x %d", s["cpu.ps"], s["cpu.emulationMode"] and 1 or 0)
      if tour and tour.current then segment[#segment + 1] = offset end
    end
  end
  emu.addMemoryCallback(coverExec, emu.callbackType.exec, 0x000000, 0x3FFFFF)
  emu.addMemoryCallback(coverExec, emu.callbackType.exec, 0x800000, 0xBFFFFF)
  -- Data reads in the code banks 80/81 (offsets 0-FFFF) in all four LoROM mirrors, at the end as "XR offset pc"
  -- with the reading instruction of the first read: the original's reads of bytes the ROM map may class as code. Mesen reports no opcode or operand fetch as a
  -- read; the one read at the PC itself is the dummy fetch at interrupt entry and is skipped. Four wide
  -- callbacks: one callback per code range (about 200) made the run slower, not faster.
  local function coverRead(address)
    if (address & 0x8000) == 0 then return end
    local offset = ((address >> 16) & 1) << 15 | (address & 0x7FFF)
    if coverReads[offset] then return end
    local s = emu.getState()
    if (s["cpu.k"] & 0x7F) == ((address >> 16) & 0x7F) and s["cpu.pc"] == (address & 0xFFFF) then return end
    coverReads[offset] = s["cpu.k"] << 16 | s["cpu.pc"]
  end
  for _, bank in ipairs({0x000000, 0x400000, 0x800000, 0xC00000}) do
    emu.addMemoryCallback(coverRead, emu.callbackType.read, bank + 0x8000, bank + 0x1FFFF)
  end
end
local function printCover()
  local list = {}
  for offset in pairs(cover) do list[#list + 1] = offset end
  table.sort(list)
  for _, offset in ipairs(list) do print(string.format("XC %05x %s", offset, cover[offset])) end
  list = {}
  for offset in pairs(coverReads) do list[#list + 1] = offset end
  table.sort(list)
  for _, offset in ipairs(list) do print(string.format("XR %05x %06x", offset, coverReads[offset])) end
end

-- Counter replacement ("counter"): the H/V counter bytes 213C/213D (Book I PDF 136, 2-27-22: latched by
-- reading 2137 or by the external latch) depend on
-- the CPU time, which the lag-free native port does not have; it feeds xorshift32 bytes instead. A read
-- callback that returns a value replaces the byte the CPU reads.
local counter = nil
local function counterByte()
  local x = counter
  x = (x ~ (x << 13)) & 0xFFFFFFFF
  x = x ~ (x >> 17)
  x = (x ~ (x << 5)) & 0xFFFFFFFF
  counter = x
  return x & 0xFF
end
local clock, waitNmis, randomRead = nil, 0, false
local LOOPS = {{0x81B0A5, 0x81B0A9}, {0x81EECD, 0x81EED1}, {0x81ACAF, 0x81ACB2}, {0x81ACBD, 0x81ACC0}, {0x81ACC3, 0x81ACC6},
  {0x81ACC9, 0x81ACCC}, {0x81CF4C, 0x81CF4F}, {0x80901C, 0x80901F}, {0x80AE0C, 0x80AE0F}, {0x80AE5E, 0x80AE61}}
for _, bank in ipairs({0x800000, 0}) do
  emu.addMemoryCallback(function()
    local sp = emu.getState()["cpu.sp"]
    local function stack(n) return emu.read((sp + n) & 0xFFFF, emu.memType.snesMemory) end
    local pc = ((stack(4) << 16) | (stack(3) << 8) | stack(2)) | 0x800000
    for _, loop in ipairs(LOOPS) do if pc >= loop[1] and pc <= loop[2] then waitNmis = waitNmis + 1 return end end
  end, emu.callbackType.exec, bank + 0xC112, bank + 0xC112)
  for _, at in ipairs({0xC56C, 0xC579}) do
    emu.addMemoryCallback(function() randomRead = true end, emu.callbackType.exec, bank + at, bank + at)
  end
end
emu.addMemoryCallback(function(address)
  if not (clock and randomRead) then return end
  randomRead = false
  local value = (clock.value + waitNmis - clock.nmis) & 0xFFFF
  if (address & 1) == 1 then return value >> 8 end
  return value & 0xFF
end, emu.callbackType.read, 0x7E1C76, 0x7E1C77)
for _, base in ipairs({0x000000, 0x800000}) do
  for bank = 0, 0x3F do
    emu.addMemoryCallback(function(address, value)
      if counter then return counterByte() end
    end, emu.callbackType.read, base + bank * 0x10000 + 0x213C, base + bank * 0x10000 + 0x213D)
  end
end

-- VRAM data writes outside VBlank with the display on (Book I: VRAM is written in VBlank or forced blank).
vram = nil
for _, bank in ipairs({0x800000, 0}) do
  emu.addMemoryCallback(function()
    if not vram then return end
    vram.total = vram.total + 1
    local s = emu.getState()
    if vram.total == 1 then vram.anyLine, vram.anyPc = s["ppu.scanline"], s["cpu.k"] * 65536 + s["cpu.pc"] end
    if s["ppu.scanline"] < 225 and not s["ppu.forcedBlank"] then
      if vram.count == 0 then vram.first, vram.pc = s["ppu.scanline"], s["cpu.k"] * 65536 + s["cpu.pc"] end
      vram.count = vram.count + 1
    end
  end, emu.callbackType.write, bank + 0x2118, bank + 0x2119)
end

-- Pseudo-random input of a tourplay entry: a key or direction held 8 to 40 frames, seeded per entry.
local PLAY_KEYS = {"up", "down", "left", "right", "up+left", "up+right", "down+left", "down+right", "up", "down", "a", "b", "y", "r", "start"}
local play = {}
function tourInput()
  if not (tour and tour.play and tour.current) then return {} end
  if play.entry ~= tour.current or play.left == nil then play = {entry = tour.current, seed = tour.current * 7919 + 1, left = 0} end
  if play.left <= 0 then
    play.seed = (play.seed * 1103515245 + 12345) % 2147483648
    local key = PLAY_KEYS[play.seed % #PLAY_KEYS + 1]
    play.keys, play.left = keys(key), 8 + (play.seed // 256) % 33
    if #key == 1 or key == "start" then play.left = 12 end
    play.held = 0
  end
  play.left, play.held = play.left - 1, play.held + 1
  if (play.keys.a or play.keys.b or play.keys.y or play.keys.r or play.keys.start) and play.held > 6 then return {} end
  return play.keys
end

emu.addEventCallback(function()
  if frames < START then local press = (frames % 120) < 6 emu.setInput({start = press, a = press}, 0) return end
  -- "watch", "track", "verbose" and "poke" use no frame, so the timing of the plan stays the same.
  while CMDS[index] ~= nil and (CMDS[index][1] == "watch" or CMDS[index][1] == "verbose" or CMDS[index][1] == "track" or CMDS[index][1] == "poke" or CMDS[index][1] == "redirect" or CMDS[index][1] == "tour" or CMDS[index][1] == "scripts" or CMDS[index][1] == "tourplay" or CMDS[index][1] == "vramwatch" or CMDS[index][1] == "readwatch" or CMDS[index][1] == "matrix" or CMDS[index][1] == "counter" or CMDS[index][1] == "clock") do
    if CMDS[index][1] == "watch" then watch = {table.unpack(CMDS[index], 2)}
    elseif CMDS[index][1] == "track" then track = CMDS[index][2]
    elseif CMDS[index][1] == "poke" then
      emu.write(CMDS[index][2], CMDS[index][3] & 0xFF, emu.memType.snesWorkRam)
      if CMDS[index][4] ~= 1 then emu.write(CMDS[index][2] + 1, CMDS[index][3] >> 8, emu.memType.snesWorkRam) end
    elseif CMDS[index][1] == "matrix" then
      local c, ram = CMDS[index], emu.memType.snesWorkRam
      local function put(address, value) emu.write(address, value & 0xFF, ram) end
      put(0x1CE9, 0xFE) put(0x1CEA, 0xFF) put(0x2DE2, c[3]) put(0x2DE3, c[3] >> 8)
      put(0x1D8D, 0x40) put(0x1D8F, c[2]) put(0x1D8E, c[4]) put(0x1D90, c[5])
      put(0x1D8C, emu.read(0x3C04, ram))
      local record = word(0x13A8 + word(0xCC2))
      if record ~= 0 then put(0x1D8B, emu.read(record + 2, ram)) put(0x1D93, record) put(0x1D94, record >> 8) end
    elseif CMDS[index][1] == "counter" then counter = CMDS[index][2] print(string.format("CTR %d", frames))
    elseif CMDS[index][1] == "clock" then clock = {value = CMDS[index][2], nmis = waitNmis}
    elseif CMDS[index][1] == "redirect" then redirect = CMDS[index][2]
    elseif CMDS[index][1] == "tour" then
      tour = {kind = "room", frames = CMDS[index][2], entries = {table.unpack(CMDS[index], 3)}, at = 1, armed = true}
    elseif CMDS[index][1] == "vramwatch" then vram = {count = 0, total = 0}
    elseif CMDS[index][1] == "readwatch" then
      for i = 2, #CMDS[index] - 1, 2 do
        emu.addMemoryCallback(function(address, value)
          local s = emu.getState()
          print(string.format("RD %d %06x %02x %06x", frames, address, value, s["cpu.k"] * 65536 + s["cpu.pc"]))
        end, emu.callbackType.read, CMDS[index][i], CMDS[index][i + 1])
      end
    elseif CMDS[index][1] == "tourplay" then
      tour = {kind = "room", play = true, frames = CMDS[index][2], entries = {table.unpack(CMDS[index], 3)}, at = 1, armed = true}
    elseif CMDS[index][1] == "scripts" then
      tour = {kind = "script", frames = CMDS[index][2], entries = {table.unpack(CMDS[index], 3)}, at = 1, armed = true}
    else verbose = true end
    index = index + 1
  end
  local c = CMDS[index]
  if c == nil then emu.setInput(tourInput(), 0) return end
  if started == nil then started, startRounds = frames, rounds end
  local t, kind, input, done = frames - started, c[1], {}, false
  local r = rounds - startRounds
  -- Timing as in the recorder (tools/mesen/trace-f390.lua): the next command starts in the frame after the last one.
  if kind == "hold" then if t < c[3] then input = keys(c[2]) end done = t + 1 >= c[3]
  elseif kind == "press" then
    if t < 6 then input = keys(c[2]) end
    if c[4] == nil then done = t + 1 >= (c[3] or 12) else done = t >= 6 and r >= c[4] end
  elseif kind == "wait" then if c[3] == nil then done = t + 1 >= c[2] else done = r >= c[3] end
  elseif kind == "until" then
    if t > 3000 then error("until: word " .. c[2] .. " never " .. c[3]) end
    done = word(c[2]) == c[3]
  elseif kind == "glove" then done = steer(input, c[2], c[3]) or t > 600
  elseif kind == "seek" then
    raster(c, c[3], c[4], c[5], c[6], 4)
    done = walkRaster(c, input, function() return tagged() == c[2] end)
    if done then local x, y = glove() print(string.format("SEEK %04x %s %d %d", c[2], tagged() == c[2] and "found" or "missing", x, y)) end
  elseif kind == "scan" then
    raster(c, c[2], c[3], c[4], c[5], c[6] or 8)
    done = walkRaster(c, input, nil)
  elseif kind == "aim" then
    done = steer(input, ((word(c[3]) >> 2) + c[5]) & 0xFF, ((word(c[4]) >> 2) + c[6]) & 0xFF) or t > 120
  elseif kind == "walk" or kind == "exit" then
    local p = player()
    if t == 0 then c.jumped, c.last = false, p end
    if p and c.last and (math.abs(p[1] - c.last[1]) > 32 or math.abs(p[2] - c.last[2]) > 32) then c.jumped = true end
    if p then c.last = p end
    if t > 2000 then error(kind .. " target not reached: command " .. index) end
    if kind == "exit" then
      if c.jumped then done = true else input = keys(c[2]) end
    elseif p then
      local function sign(d) if d > 0 then return 1 elseif d < 0 then return -1 else return 0 end end
      local sx, sy = sign(c[3] - p[1]), sign(c[4] - p[2])
      if sx == 0 and sy == 0 then done = true else input = keys(STEER[(sx + 1) * 3 + sy + 2]) end
    end
  elseif kind == "profile" then
    armProfile()
    profiling = t + 1 < c[2]
    done = t + 1 >= c[2]
    if done then
      local list = {}
      for address, n in pairs(profile) do list[#list + 1] = address end
      table.sort(list)
      for _, address in ipairs(list) do print(string.format("X %06x %d", address, profile[address])) end
      profile = {}
    end
  elseif kind == "mark" or kind == "rewind" then
    if t == 0 then snapshot.want, snapshot.cmd = kind, c end
    done = c.done == true
  elseif kind == "sram" then
    local hex = {}
    for a = 0, 0x1FFF do hex[a + 1] = string.format("%02x", emu.read(a, emu.memType.snesSaveRam)) end
    print("SRAM " .. c[2] .. " " .. table.concat(hex))
    done = true
  elseif kind == "shot" then
    local x, y = glove()
    print(string.format("C %d %d %d", frames, x, y))
    local png, hex = emu.takeScreenshot(), {}
    for i = 1, #png do hex[i] = string.format("%02x", png:byte(i)) end
    print("PNG " .. c[2] .. " " .. table.concat(hex))
    done = true
  else error("unknown command " .. tostring(kind)) end
  emu.setInput(input, 0)
  if done then index, started = index + 1, nil end
end, emu.eventType.inputPolled)

-- Tour step: after n frames in a room load the saved state again with the next entry armed.
local function tourStep()
  -- A halted CPU (a script run with foreign arguments) serves no exec callback, and Mesen does not load
  -- states from the frame end: after three frames a reset lets the next instruction serve the load.
  if tour and tour.load then
    tour.waiting = tour.waiting + 1
    if tour.waiting == 3 then print(string.format("RESET %d", frames)) emu.reset() end
  end
  if not tour or tour.left == nil then return end
  tour.left = tour.left - 1
  if tour.left > 0 then return end
  tour.left, tour.at = nil, tour.at + 1
  if tour.at <= #tour.entries then tour.load, tour.waiting = true, 0 end
end

emu.addEventCallback(function()
  frames = frames + 1
  if vram and vram.total > 0 then
    print(string.format("V %d %d %d %d %06x %d %06x", frames, vram.count, vram.total, vram.first or -1, vram.pc or 0, vram.anyLine, vram.anyPc))
    vram.count, vram.total, vram.first, vram.pc = 0, 0, nil, nil
  end
  tourStep()
  if frames >= START then
    local object = tagged()
    local key = object and string.format("%04x", object) or "none"
    if key ~= lastObject then
      local x, y = glove()
      print(string.format("O %d %d %d %s", frames, x, y, key))
      lastObject = key
    end
  end
  if watch and frames % 4 == 0 then
    local x, y = glove()
    local values = {}
    for i, address in ipairs(watch) do values[i] = string.format("%04x", word(address)) end
    print(string.format("W %d %d %d %s %s", frames, x, y, lastObject or "none", table.concat(values, " ")))
  end
  if track and frames % track == 0 then
    local slot = word(0xCC2)
    if slot < 0x8000 then print(string.format("P %d %d %d", frames, word(0xE28 + slot) >> 2, word(0xE80 + slot) >> 2)) end
  end
  if tour and tour.at > #tour.entries then flushSegment() tour = nil end
  if (CMDS[index] == nil and tour == nil and frames > START) or frames >= LIMIT then printCover() print("END " .. frames) emu.stop(0) end
end, emu.eventType.endFrame)
