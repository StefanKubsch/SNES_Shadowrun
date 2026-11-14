-- Test oracle only: cold reset with the input plan of the room recording
-- (trace-boot-prefix.lua, ROOM_RECORD_OPTIONS) up to the same 80:96C3 stop
-- point, then one pad word per NMI from PADS. No game state writes.
-- Output: "S" at the stop point, "H k pc s frame" for each live NMI entry
-- (interrupted PB:PC and S before the hardware frame), "Q k frame" when the
-- pad for live NMI k is polled, CPU/WRAM/SRAM/PPU at the LIVE_ROUNDS-th
-- 80:96C3 after the stop point and "FRAME k" at the next end of frame.
-- "SHOT k ..." is the same picture at the end of the frame before live NMI k
-- for each k in SHOTS (taken outside the NMI, like FRAME). With SHOT_PPU each
-- SHOT is followed by "SP k key=value..." (all ppu.* state fields) and the
-- PPU memory at that moment ("SV"/"SC"/"SO" offset hex).
-- With SOUND: "E k env0..env7" (DSP envelopes at live NMI k) and "K k reg value"
-- for each KON ($4C) and KOF ($5C) write of the SPC during the live part.
-- With LIVE_SRAM the save memory is replaced at the stop point (test setup).
-- With LIVE_PLAN the pads from live NMI LIVE_PLAN_FROM on come from the plan
-- commands (tools/live-plan-driver.mjs, same rules on the original's WRAM);
-- The state is taken at the end of the plan if that comes first.
-- "C i k slot x y rounds" when command i ends at live NMI k (player position and
-- completed live rounds; a rounds count ends wait/press after that many 80:96C3),
-- with SHOT_ENDS also a SHOT before live NMI k + 1, "P k slot x y" every TRACK NMIs.
local started, done, live = false, false, false
local nmis, inNmi, completedNativeNmi, completedNativeTarget, roomFrames = 0, false, false, 0, 0
local liveNmis, liveRounds, checkpointHits, owner, ownerFrames, finalFrame = 0, 0, 0, false, 0, false
local sequence = 0
local tracked = {}
local function out(line) sequence = sequence + 1; print(line .. " #" .. sequence) end
local function bytes(tag, memType, size)
  local chunk = {}
  for i = 0, size - 1 do
    chunk[#chunk + 1] = string.format("%02x", emu.read(i, memType))
    if #chunk == 4096 then out(tag .. " " .. (i - 4095) .. " " .. table.concat(chunk)); chunk = {} end
  end
  if #chunk > 0 then out(tag .. " " .. (size - #chunk) .. " " .. table.concat(chunk)) end
end
for _, bank in ipairs({0, 0x800000}) do
  emu.addMemoryCallback(function() if not started then started = true end end, emu.callbackType.exec, bank + 0xE382, bank + 0xE382)
  emu.addMemoryCallback(function()
    if not started or done then return end
    if inNmi then error("Nested NMI") end
    inNmi = true; nmis = nmis + 1
    if not live then return end
    local s = emu.getState()
    local sp = s["cpu.sp"]
    local function stack(n) return emu.read((sp + n) & 0xFFFF, emu.memType.snesMemory) end
    local pc = (stack(4) << 16) | (stack(3) << 8) | stack(2)
    out(string.format("H %d %x %x %d", liveNmis, pc, (sp + 4) & 0xFFFF, s["ppu.frameCount"]))
    if SOUND then
      local env = {}
      for v = 0, 7 do env[#env + 1] = s["spc.dsp.voices[" .. v .. "].envVolume"] end
      out("E " .. liveNmis .. " " .. table.concat(env, " "))
    end
    liveNmis = liveNmis + 1
  end, emu.callbackType.exec, bank + 0xC112, bank + 0xC112)
  emu.addMemoryCallback(function() if started and not done then inNmi = false end end, emu.callbackType.exec, bank + 0xC14E, bank + 0xC14E)
end
-- Same Native return tracking as the room recorder; only its counters are used.
local open = {}
emu.addMemoryCallback(function()
  if not started or done or inNmi or live then return end
  local target = 0x800000 | emu.read(0xA2, emu.memType.snesMemory) | (emu.read(0xA3, emu.memType.snesMemory) << 8)
  if not NATIVE_TARGETS[target] then return end
  open[#open + 1] = {target = target, sp = emu.getState()["cpu.sp"], nmis = nmis}
end, emu.callbackType.exec, 0x80F52F, 0x80F52F)
emu.addMemoryCallback(function()
  if not started or done or inNmi or live or #open == 0 then return end
  local call = open[#open]
  if emu.getState()["cpu.sp"] ~= ((call.sp + 2) & 0xFFFF) then return end
  open[#open] = nil
  if nmis > call.nmis then completedNativeNmi = true end
  if call.target == 0x80E014 then completedNativeTarget = completedNativeTarget + 1 end
end, emu.callbackType.exec, 0x80F509, 0x80F509)
emu.addMemoryCallback(function() owner = true end, emu.callbackType.exec, 0x80A139, 0x80A139)
-- Mesen's state has no 2130 bits 7-4 (color window regions) nor the window
-- logic 212A/212B: the last CPU write to each is added to "SP" as wNNNN=value.
local lastWrites = {}
if SHOT_PPU then
  for _, base in ipairs({0x000000, 0x800000}) do
    for bank = 0, 0x3F do
      emu.addMemoryCallback(function(address, value) lastWrites[address & 0xFFFF] = value end,
        emu.callbackType.write, base + bank * 0x10000 + 0x212A, base + bank * 0x10000 + 0x2130)
    end
  end
end
emu.addEventCallback(function()
  if owner then ownerFrames = ownerFrames + 1 end
  if started and not live then
    local wanted = roomFrames == 0 and completedNativeTarget >= 1 or roomFrames == 1 and completedNativeTarget >= 3
    if wanted then roomFrames = roomFrames + 1 end
  end
  if live and not done and SHOTS[liveNmis] and not inNmi then
    local size, rgb = emu.getScreenSize(), {}
    local screen = emu.getScreenBuffer()
    for i = 1, #screen do rgb[#rgb + 1] = string.format("%06x", screen[i] & 0xFFFFFF) end
    out("SHOT " .. liveNmis .. " " .. emu.getState()["ppu.scanline"] .. " " .. size.width .. " " .. size.height .. " " .. table.concat(rgb))
    SHOTS[liveNmis] = nil
    if SHOT_PPU then
      local state, fields = emu.getState(), {}
      for key, value in pairs(state) do
        if string.sub(key, 1, 4) == "ppu." then fields[#fields + 1] = string.sub(key, 5) .. "=" .. tostring(value) end
      end
      for _, port in ipairs({0x212A, 0x212B, 0x2130}) do
        if lastWrites[port] then fields[#fields + 1] = string.format("w%04X=%d", port, lastWrites[port]) end
      end
      table.sort(fields)
      out("SP " .. liveNmis .. " " .. table.concat(fields, " "))
      bytes("SV", emu.memType.snesVideoRam, 65536)
      bytes("SC", emu.memType.snesCgRam, 512)
      bytes("SO", emu.memType.snesSpriteRam, 544)
    end
  end
  if finalFrame and not done then
    if inNmi then error("Final frame inside NMI") end
    local size, rgb = emu.getScreenSize(), {}
    local screen = emu.getScreenBuffer()
    for i = 1, #screen do rgb[#rgb + 1] = string.format("%06x", screen[i] & 0xFFFFFF) end
    out("FRAME " .. liveNmis .. " " .. emu.getState()["ppu.scanline"] .. " " .. size.width .. " " .. size.height .. " " .. table.concat(rgb))
    done = true
    print("N " .. sequence)
    emu.stop(0)
  end
end, emu.eventType.endFrame)
local BITS = {b = 0x8000, y = 0x4000, select = 0x2000, start = 0x1000, up = 0x0800, down = 0x0400,
  left = 0x0200, right = 0x0100, a = 0x0080, x = 0x0040, l = 0x0020, r = 0x0010}
-- Player world axes: up+left +x, down+right -x, up+right +y, down+left -y.
local STEER = {BITS.down, BITS.down | BITS.right, BITS.right, BITS.down | BITS.left, 0, BITS.up | BITS.right,
  BITS.left, BITS.up | BITS.left, BITS.up}
local function keyWord(text)
  local result = 0
  for key in string.gmatch(text, "[^+]+") do result = result | BITS[key] end
  return result
end
local function wramWord(address) return emu.read(address, emu.memType.snesWorkRam) | (emu.read(address + 1, emu.memType.snesWorkRam) << 8) end
local planIndex, planStart, planRounds, planPads, jumped, last = 1, nil, 0, {}, false, nil
local function player()
  local slot = wramWord(0xCC2)
  if slot >= 0x8000 then return nil end
  return {wramWord(0xE28 + slot) >> 2, wramWord(0xE80 + slot) >> 2}
end
-- Same steps as livePlanDriver: each pad word is decided once per live NMI k.
local function planStep(k)
  while true do
    local command = LIVE_PLAN[planIndex]
    if command == nil then return 0 end
    if planStart == nil then planStart, planRounds = k, liveRounds end
    local t, kind, input, finished = k - planStart, command[1], 0, false
    local r = liveRounds - planRounds
    if kind == "hold" then input = t < command[3] and keyWord(command[2]) or 0; finished = t + 1 >= command[3]
    elseif kind == "press" then
      input = t < 6 and keyWord(command[2]) or 0
      if command[4] == nil then finished = t + 1 >= (command[3] or 12) else finished = t >= 6 and r >= command[4] end
    elseif kind == "wait" then
      if command[3] == nil then finished = t + 1 >= command[2] else finished = r >= command[3] end
    elseif kind == "walk" or kind == "exit" then
      local p = player()
      if t == 0 then jumped, last = false, p end
      if p and last and (math.abs(p[1] - last[1]) > 32 or math.abs(p[2] - last[2]) > 32) then jumped = true end
      if p then last = p end
      if t > 2000 then error(kind .. " target not reached: command " .. (planIndex - 1)) end
      if kind == "exit" then
        if jumped then finished = true else input = keyWord(command[2]) end
      elseif p then
        local function step(d) if d > 0 then return 1 elseif d < 0 then return -1 else return 0 end end
        local sx, sy = step(command[3] - p[1]), step(command[4] - p[2])
        if sx == 0 and sy == 0 then finished = true else input = STEER[(sx + 1) * 3 + sy + 2] end
      end
    elseif kind == "glove" or kind == "aim" then
      local x, y = emu.read(0x1D5, emu.memType.snesWorkRam), emu.read(0x1D7, emu.memType.snesWorkRam)
      local tx, ty = command[2], command[3]
      if kind == "aim" then tx, ty = ((wramWord(command[3]) >> 2) + command[5]) & 0xFF, ((wramWord(command[4]) >> 2) + command[6]) & 0xFF end
      if math.abs(x - tx) <= 1 and math.abs(y - ty) <= 1 or kind == "aim" and t > 120 then finished = true
      else
        if t > 600 then error("glove target not reached: command " .. (planIndex - 1) .. " at " .. x .. "," .. y) end
        if x < tx - 1 then input = input | BITS.right elseif x > tx + 1 then input = input | BITS.left end
        if y < ty - 1 then input = input | BITS.down elseif y > ty + 1 then input = input | BITS.up end
      end
    else error("unknown plan command " .. tostring(kind)) end
    if finished then
      local slot = wramWord(0xCC2)
      out(string.format("C %d %d %d %d %d %d", planIndex - 1, k, slot, wramWord(0xE28 + (slot & 0x7FFF)), wramWord(0xE80 + (slot & 0x7FFF)), liveRounds))
      if SHOT_ENDS then SHOTS[k + 1] = true end
      planIndex, planStart = planIndex + 1, nil
      if kind ~= "hold" and kind ~= "press" and kind ~= "wait" then goto continue end
    end
    do return input end
    ::continue::
  end
end
local function livePad(k)
  if not LIVE_PLAN or k < LIVE_PLAN_FROM then return PADS[k + 1] or 0 end
  if planPads[k] == nil then planPads[k] = planStep(k) end
  return planPads[k]
end
emu.addEventCallback(function()
  if live then
    -- The pad of the NMI that this auto-read belongs to; logged for alignment.
    local k = inNmi and liveNmis - 1 or liveNmis
    local pad = livePad(k)
    if TRACK > 0 and k % TRACK == 0 and not tracked[k] then
      tracked[k] = true
      local slot = wramWord(0xCC2)
      if slot < 0x8000 then out(string.format("P %d %d %d %d", k, slot, wramWord(0xE28 + slot), wramWord(0xE80 + slot))) end
    end
    local input = {}
    for name, bit in pairs(BITS) do input[name] = (pad & bit) ~= 0 end
    emu.setInput(input, 0)
    out(string.format("Q %d %d %d", k, emu.getState()["ppu.frameCount"], inNmi and 1 or 0))
    return
  end
  if completedNativeTarget > 0 then emu.setInput({right = true}, 0); return end
  local press = owner and ownerFrames % 30 < 6
  local start = press and not completedNativeNmi
  emu.setInput({a = press, start = start}, 0)
end, emu.eventType.inputPolled)
emu.addMemoryCallback(function()
  if not started or done or finalFrame then return end
  if live then
    liveRounds = liveRounds + 1
    if liveRounds < LIVE_ROUNDS and not (LIVE_PLAN and LIVE_PLAN[planIndex] == nil) then return end
    local s = emu.getState()
    out(string.format("F %x %x %x %x %x %x %x %x %d %d", s["cpu.a"], s["cpu.x"], s["cpu.y"], s["cpu.sp"],
      s["cpu.d"], s["cpu.dbr"], s["cpu.ps"], (s["cpu.k"] << 16) | s["cpu.pc"], s["cpu.emulationMode"] and 1 or 0, liveNmis))
    bytes("FW", emu.memType.snesWorkRam, 0x20000)
    bytes("FM", emu.memType.snesSaveRam, 0x2000)
    bytes("PPUV", emu.memType.snesVideoRam, 65536)
    bytes("PPUC", emu.memType.snesCgRam, 512)
    bytes("PPUO", emu.memType.snesSpriteRam, 544)
    finalFrame = true
    return
  end
  checkpointHits = checkpointHits + 1
  if checkpointHits < 3 or completedNativeTarget < 3 or roomFrames < 2 then return end
  live = true
  -- LIVE_SRAM (hex, 8 KiB): the same save memory as the native live start (test setup).
  if LIVE_SRAM then
    for i = 0, 0x1FFF do emu.write(i, tonumber(string.sub(LIVE_SRAM, i * 2 + 1, i * 2 + 2), 16), emu.memType.snesSaveRam) end
  end
  out(string.format("S %d %d", nmis, emu.getState()["ppu.frameCount"]))
end, emu.callbackType.exec, 0x8096C3, 0x8096C3)
if SOUND then
  emu.addMemoryCallback(function(address, value)
    if not live or done then return end
    local reg = emu.read(0xF2, emu.memType.spcRam)
    if reg == 0x4C or reg == 0x5C then out(string.format("K %d %x %x", liveNmis, reg, value)) end
  end, emu.callbackType.write, 0x00F3, 0x00F3, emu.cpuType.spc, emu.memType.spcMemory)
end
