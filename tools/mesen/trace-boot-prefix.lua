-- Test oracle only: cold reset through a selected original startup entry.
-- Snapshot before executing either checkpoint. Optional joypad input only;
-- no game state writes.
local started, done, sequence, nmis = false, false, 0, 0
local dmaTriggerPcAfter = nil
local dmaFlagKeys = nil
local inNmi = false
local stopPc = STOP_PC or 0x81EEBB
local ioSequence = 0
local instructionSteps = 0
local completedNativeNmi = false
local completedNativeTarget = 0
local reversePending = false
local ppuWrites, ppuWindow, roomFrames = 0, nil, 0
local flushRead
local function emit(line)
  sequence = sequence + 1
  print(line .. " #" .. sequence)
end
local function out(line)
  if flushRead then flushRead() end
  emit(line)
end
local readRun = nil
flushRead = function()
  if readRun then
    emit(string.format("R %x %x %x %d", readRun.address, readRun.value, readRun.pcAfter, readRun.count))
    readRun = nil
  end
end
local function recordRead(address, value, pcAfter)
  ioSequence = ioSequence + 1
  if readRun and readRun.address == address and readRun.value == value and readRun.pcAfter == pcAfter then
    readRun.count = readRun.count + 1
  else
    flushRead()
    readRun = {address = address, value = value, pcAfter = pcAfter, count = 1}
  end
end
-- A CPU exec callback pins the actual APU polling instruction. It is used
-- only while every observed DMA command has a proved non-IO source and
-- forward B-bus writes. Any unknown command or HDMA permanently disables
-- this fast path; DMA outputs always retain their actual channel flags.
local apuRead, cpuPollSafe, dmaRegisters = nil, true, {}
for pc, port in pairs({[0x81F046]=0x2140, [0x81F00E]=0x2140}) do
  local observed = {pcAfter = pc + 3, port = port}
  emu.addMemoryCallback(function() apuRead = observed end, emu.callbackType.exec, pc, pc)
end
local function observeCommand(port, value)
  if port >= 0x4300 and port <= 0x437F then dmaRegisters[port - 0x4300] = value end
  if port == 0x420C and value ~= 0 then cpuPollSafe = false end
  if port == 0x4200 and (value & 0x30) ~= 0 then cpuPollSafe = false end
  if port ~= 0x420B or value == 0 or not cpuPollSafe then return end
  for channel = 0, 7 do
    if (value & (1 << channel)) ~= 0 then
      local r = channel * 16
      for n = 0, 6 do if dmaRegisters[r + n] == nil then cpuPollSafe = false; return end end
      local mode, bank = dmaRegisters[r], dmaRegisters[r + 4]
      if mode ~= 0 and mode ~= 1 and mode ~= 8 and mode ~= 9 then cpuPollSafe = false; return end
      if (bank & 0x40) == 0 then
        local source = dmaRegisters[r + 2] | (dmaRegisters[r + 3] << 8)
        local length = dmaRegisters[r + 5] | (dmaRegisters[r + 6] << 8)
        if length == 0 then length = 65536 end
        local last = (mode & 8) ~= 0 and source or source + length - 1
        if not ((source < 0x2000 and last < 0x2000) or (source >= 0x8000 and last <= 0xFFFF)) then
          cpuPollSafe = false; return
        end
      end
    end
  end
end
-- Lossless run-length encoding of the two original counter polls. Flush
-- before any IO, interrupt or other instruction; the order remains exact.
local pollCount, pollHalf, pollStart, pollEnd = 0, false, nil, nil
local function flushPoll()
  if pollCount > 0 then out(string.format("L %d %x %x", pollCount, pollStart, pollEnd)) end
  if pollHalf then out(string.format("T %x", pollStart)) end
  pollCount, pollHalf, pollStart, pollEnd = 0, false, nil, nil
end
local function bytes(tag, kind, count)
  local parts = {}
  for i = 0, count - 1 do parts[#parts + 1] = string.format("%02x", emu.read(i, kind)) end
  out(tag .. " " .. table.concat(parts))
end
local function flushPpuWindow()
  if not ppuWindow then return end
  local w = ppuWindow
  out(string.format("W %d %d %d %d %d %d", w.start, w.count, w.frame, w.first, w.last, w.blank and 1 or 0))
  ppuWindow = nil
end
local function observePpuWindow(s)
  local line, frame, blank = s["ppu.scanline"], s["ppu.frameCount"], s["ppu.forcedBlank"]
  if type(line) ~= "number" or type(frame) ~= "number" or type(blank) ~= "boolean" then error("Missing original PPU write window") end
  local band = line >= 225 and 1 or 0
  if ppuWindow and (ppuWindow.frame ~= frame or ppuWindow.blank ~= blank or ppuWindow.band ~= band) then flushPpuWindow() end
  if not ppuWindow then ppuWindow = {start=ppuWrites, count=0, frame=frame, first=line, last=line, blank=blank, band=band} end
  ppuWindow.count = ppuWindow.count + 1
  ppuWindow.first, ppuWindow.last = math.min(ppuWindow.first,line), math.max(ppuWindow.last,line)
  ppuWrites = ppuWrites + 1
end
local function video()
  bytes("PPUV", emu.memType.snesVideoRam, 65536)
  bytes("PPUC", emu.memType.snesCgRam, 512)
  bytes("PPUO", emu.memType.snesSpriteRam, 544)
  local size, rgb = emu.getScreenSize(), {}
  local screen = emu.getScreenBuffer()
  for i = 1, #screen do rgb[#rgb + 1] = string.format("%06x", screen[i] & 0xFFFFFF) end
  out("FRAME " .. size.width .. " " .. size.height .. " " .. table.concat(rgb))
end
if CAPTURE_ROOM_FRAMES then
  emu.addEventCallback(function()
    if not started or done then return end
    local wanted = roomFrames == 0 and completedNativeTarget >= 1 or roomFrames == 1 and completedNativeTarget >= 3
    if not wanted then return end
    flushPpuWindow()
    local s = emu.getState()
    out(string.format("J %d %d %d %d %d", s["ppu.frameCount"], ioSequence, ppuWrites, completedNativeTarget, s["ppu.scanline"]))
    video()
    roomFrames = roomFrames + 1
  end, emu.eventType.endFrame)
end
local function checkpoint(tag)
  flushPoll()
  local s = emu.getState()
  local e = s["cpu.emulationMode"]
  if e == nil then
    local keys = {}
    for key, value in pairs(s) do
      if string.sub(key, 1, 4) == "cpu." then keys[#keys + 1] = key .. "=" .. tostring(value) end
    end
    error("Missing observed CPU E: " .. table.concat(keys, ", "))
  end
  out(string.format("%s %x %x %x %x %x %x %x %x %x %d", tag,
    s["cpu.a"], s["cpu.x"], s["cpu.y"], s["cpu.sp"], s["cpu.d"], s["cpu.dbr"],
    s["cpu.ps"], s["cpu.k"], s["cpu.pc"], e and 1 or 0))
  bytes(tag .. "W", emu.memType.snesWorkRam, 0x20000)
  bytes(tag .. "M", emu.memType.snesSaveRam, 0x2000)
end
-- Mesen serializes each channel's DmaActive flag in emu.getState(). A CPU
-- opcode callback can precede a pending transfer, so PC windows are not used
-- to classify bus ownership. Preserve every actual DMA output byte.
for _, bank in ipairs({0, 0x800000}) do
  emu.addMemoryCallback(function()
    if started or done then return end
    checkpoint("I")
    started = true
  end, emu.callbackType.exec, bank + 0xE382, bank + 0xE382)
end
-- CPU register mirrors in every system bank, including DBR81 in DDB1.
-- Reset/NMI code entry hooks below remain limited to their real code banks.
for bankId = 0, 0xBF do
  if (bankId & 0x40) == 0 then
  local bank = bankId << 16
  for _, range in ipairs({{0x2100, 0x21FF}, {0x4200, 0x43FF}}) do
    for _, access in ipairs({{"r", emu.callbackType.read}, {"w", emu.callbackType.write}}) do
      emu.addMemoryCallback(function(address, value)
        if not started or done then return end
        if access[1] == "r" and cpuPollSafe and not inNmi and apuRead and (address & 0xFFFF) == apuRead.port then
          flushPoll()
          recordRead(address, value, apuRead.pcAfter)
          apuRead = nil
          return
        end
        local s = emu.getState()
        if dmaFlagKeys == nil then
          dmaFlagKeys = {}
          for key, v in pairs(s) do
            if string.match(key, "%.dmaActive$") then dmaFlagKeys[#dmaFlagKeys + 1] = key end
          end
          if #dmaFlagKeys ~= 8 then error("Missing observed DMA channel flags") end
        end
        local active = false
        for _, key in ipairs(dmaFlagKeys) do
          if type(s[key]) ~= "boolean" then error("Invalid observed DMA flag") end
          active = active or s[key]
        end
        local pcAfter = (s["cpu.k"] << 16) | s["cpu.pc"]
        if CAPTURE_ROOM_FRAMES and access[1] == "w" and (address & 0xFFFF) <= 0x2133 then observePpuWindow(s) end
        if access[1] == "w" and (address & 0xFFFF) == 0x420B and value ~= 0 then dmaTriggerPcAfter = pcAfter end
        if active and access[1] ~= "w" then error("DMA read outside this prefix contract") end
        if active and dmaTriggerPcAfter == nil then error("DMA without observed MDMAEN") end
        flushPoll()
        if access[1] == "w" and not active then observeCommand(address & 0xFFFF, value) end
        if access[1] == "r" then
          recordRead(address, value, pcAfter)
          apuRead = nil
          return
        end
        ioSequence = ioSequence + 1
        -- For a DMA byte the PC identifies its observed triggering request.
        out(string.format("%s %x %x %x", active and "d" or access[1], address, value, active and dmaTriggerPcAfter or pcAfter))
      end, access[2], bank + range[1], bank + range[2], emu.cpuType.snes, emu.memType.snesMemory)
    end
  end
  end
end
for _, bank in ipairs({0, 0x800000}) do
  emu.addMemoryCallback(function()
    if not started or done then return end
    if inNmi then error("Nested boot NMI") end
    inNmi = true
    apuRead = nil
    nmis = nmis + 1
    local s = emu.getState()
    local sp = s["cpu.sp"]
    local function stack(n) return emu.read((sp + n) & 0xFFFF, emu.memType.snesMemory) end
    -- The hardware has already pushed P, PC, PB. Record the genuine resume
    -- address; never infer it from the last opcode callback or frame number.
    flushPoll()
    if s["cpu.emulationMode"] then error("Boot NMI outside native mode") end
    out(string.format("H %x %d %x %x %x %x %x %x %x %x", (stack(4) << 16) | (stack(3) << 8) | stack(2), ioSequence,
      s["cpu.a"], s["cpu.x"], s["cpu.y"], (sp + 4) & 0xFFFF, s["cpu.d"], s["cpu.dbr"], stack(1), 0))
  end, emu.callbackType.exec, bank + 0xC112, bank + 0xC112)
  emu.addMemoryCallback(function()
    if started and not done then inNmi = false end
  end, emu.callbackType.exec, bank + 0xC14E, bank + 0xC14E)
end
for _, range in ipairs({{0x81EEBB, 0x81EED4}, {0x81EFA5, 0x81F006}, {0x81F07F, 0x81F091}, {0x81EF07, 0x81EF25},
  {0x809E1A, 0x809E3C}, {0x81DE28, 0x81DE28}, {0x81EB7B, 0x81EB88}, {0x809E65, 0x80A032},
  {0x81E1B4, 0x81E1BD}, {0x81E510, 0x81E515}, {0x80966D, 0x809687},
  {0x81B0A1, 0x81B0AB}, {0x81ACAF, 0x81ACBC},
  {0x818FCB, 0x818FCB}, {0x819025, 0x819025}, {0x819028, 0x819028}, {0x819039, 0x819039},
  {0x819247, 0x819247}, {0x819381, 0x819381}, {0x819438, 0x819438},
  {0x818E96, 0x818E96}, {0x818EA2, 0x818EA2}, {0x8191D4, 0x8191D4},
  {0x818E5E, 0x818E5E}, {0x8191EC, 0x8191EC}, {0x8191D6, 0x8191D6}, {0x818EBE, 0x818EBE},
  {0x81A1FC, 0x81A1FC}, {0x819D10, 0x819D10}, {0x819CFA, 0x819CFA}, {0x819B17, 0x819B17},
  {0x819F4F, 0x819F4F}, {0x81A21D, 0x81A21D}, {0x8189ED, 0x8189ED}, {0x81842A, 0x81842A},
  {0x81A9CC, 0x81A9CC}, {0x81F049, 0x81F049}, {0x81F04B, 0x81F04B}, {0x81F05B, 0x81F05B},
  {0x81F1A5, 0x81F1A5}, {0x81F1A8, 0x81F1A8},
  {0x81ACBD, 0x81ACCE}, {0x81AEF4, 0x81AF03}, {0x80AC8F, 0x80AC8F},
  {0x80901C, 0x80901F}, {0x80AE0C, 0x80AE0F}, {0x80AE5E, 0x80AE61}, {0x80FD21, 0x80FD21}}) do
  emu.addMemoryCallback(function(address)
    if not started or done or inNmi or address == stopPc then return end
    instructionSteps = instructionSteps + 1
    if address == 0x81EECD or address == 0x81B0A5 then
      if pollStart ~= address or pollHalf then
        flushPoll()
        pollStart, pollEnd = address, address == 0x81EECD and 0x81EED1 or 0x81B0A9
      end
      pollHalf = true; return
    end
    if pollHalf and address == pollEnd then pollHalf = false; pollCount = pollCount + 1; return end
    flushPoll()
    out(string.format("T %x", address))
  end, emu.callbackType.exec, range[1], range[2])
end
-- The B-bus write hook cannot see reverse transfers. Pin the real STA and
-- observe the resulting sixteen WRAM bytes before AA98 STZ $01FC. AA96 REP
-- is the only intervening CPU instruction and writes no memory. The CPU
-- halts during DMA; an exec callback at AA96 alone could precede that DMA.
emu.addMemoryCallback(function()
  if not started or done then return end
  if reversePending then error("Unfinished reverse DMA") end
  local s = emu.getState()
  if (s["cpu.a"] & 0xFF) ~= 0x20 or (s["cpu.ps"] & 0x20) == 0 then error("Changed reverse DMA trigger") end
  local expected = {[0x50]=0x81, [0x51]=0x39, [0x52]=0xE0, [0x53]=0x2A, [0x54]=0x7E, [0x55]=16, [0x56]=0}
  for at, value in pairs(expected) do if dmaRegisters[at] ~= value then error("Changed reverse DMA register " .. at) end end
  reversePending = true
end, emu.callbackType.exec, 0x81AA93, 0x81AA93)
emu.addMemoryCallback(function()
  if not started or done or not reversePending then return end
  local s = emu.getState()
  if not dmaFlagKeys or #dmaFlagKeys ~= 8 then error("Missing reverse DMA completion flags") end
  for _, key in ipairs(dmaFlagKeys) do if s[key] ~= false then error("Reverse DMA still active") end end
  if dmaTriggerPcAfter ~= 0x81AA96 then error("Missing reverse DMA request") end
  flushPoll()
  for n = 0, 15 do
    local value = emu.read(0x2AE0 + n, emu.memType.snesWorkRam)
    ioSequence = ioSequence + 1
    out(string.format("v %x %x %x", 0x7E2AE0 + n, value, dmaTriggerPcAfter))
  end
  reversePending = false
end, emu.callbackType.exec, 0x81AA98, 0x81AA98)
if NATIVE_TARGETS then
  local open = {}
  local function point(tag, target, s, raw)
    flushPoll()
    if s["cpu.emulationMode"] == nil then error("Missing native caller E") end
    local line = string.format("%s %x %d %d %x %x %x %x %x %x %x %x %x %d %x",
      tag, target, ioSequence, instructionSteps, s["cpu.a"], s["cpu.x"], s["cpu.y"], s["cpu.sp"],
      s["cpu.d"], s["cpu.dbr"], s["cpu.ps"], s["cpu.k"], s["cpu.pc"], s["cpu.emulationMode"] and 1 or 0, raw)
    if target == 0x80E014 then
      local function word(at) return emu.read(at, emu.memType.snesWorkRam) | (emu.read(at + 1, emu.memType.snesWorkRam) << 8) end
      local slot = word(0xCC2)
      if slot >= 0xB0 or (slot & 1) ~= 0 then error("Invalid original player slot") end
      line = line .. string.format(" %x %x %x %x %x %x %x %x", slot,
        word(0xE28 + slot), word(0xE80 + slot), word(0xED8 + slot),
        word(0xD20 + slot), word(0xD78 + slot), word(0xDD0 + slot), word(0x1CA))
    end
    out(line)
  end
  emu.addMemoryCallback(function()
    if not started or done or inNmi then return end
    if emu.read(0x80F52F, emu.memType.snesMemory) ~= 0x6C or
      emu.read(0x80F530, emu.memType.snesMemory) ~= 0xA2 or
      emu.read(0x80F531, emu.memType.snesMemory) ~= 0 then error("Changed original native JMP") end
    local target = 0x800000 | emu.read(0xA2, emu.memType.snesMemory) | (emu.read(0xA3, emu.memType.snesMemory) << 8)
    if not NATIVE_TARGETS[target] then return end
    local s = emu.getState()
    local sp = s["cpu.sp"]
    local raw = emu.read((sp + 1) & 0xFFFF, emu.memType.snesMemory) | (emu.read((sp + 2) & 0xFFFF, emu.memType.snesMemory) << 8)
    if raw ~= 0xF508 then error("Changed original native return frame") end
    open[#open + 1] = {target = target, sp = sp, raw = raw, nmis = nmis}
    point("G", target, s, raw)
  end, emu.callbackType.exec, 0x80F52F, 0x80F52F)
  emu.addMemoryCallback(function()
    if not started or done or inNmi or #open == 0 then return end
    local s, call = emu.getState(), open[#open]
    -- A nested admitted Native also returns here. Only this caller's real
    -- outer stack closes its observation interval.
    if s["cpu.sp"] ~= ((call.sp + 2) & 0xFFFF) then return end
    open[#open] = nil
    if nmis > call.nmis then completedNativeNmi = true end
    if call.target == STOP_NATIVE_TARGET then completedNativeTarget = completedNativeTarget + 1 end
    point("V", call.target, s, call.raw)
  end, emu.callbackType.exec, 0x80F509, 0x80F509)
end
if CAPTURE_MAIN_CALLS then
  local mainCallPending = false
  emu.addMemoryCallback(function()
    if not started or done then return end
    if mainCallPending then error("Unconsumed original main JSR") end
    if emu.read(0x8096C0, emu.memType.snesMemory) ~= 0x20 or
      emu.read(0x8096C1, emu.memType.snesMemory) ~= 0xE3 or
      emu.read(0x8096C2, emu.memType.snesMemory) ~= 0xC1 then error("Changed original main JSR") end
    mainCallPending = true
  end, emu.callbackType.exec, 0x8096C0, 0x8096C0)
  emu.addMemoryCallback(function()
    if not started or done or not mainCallPending then return end
    mainCallPending = false
    local s = emu.getState()
    local sp = s["cpu.sp"]
    if sp > 0x1FFD then error("Main caller stack outside observed WRAM") end
    local raw = emu.read(sp + 1, emu.memType.snesWorkRam) | (emu.read(sp + 2, emu.memType.snesWorkRam) << 8)
    if raw ~= 0x96C2 then error("Changed original main return frame") end
    flushPoll()
    if s["cpu.emulationMode"] == nil then error("Missing main caller E") end
    out(string.format("B 80c1e3 %d %d %x %x %x %x %x %x %x %x %x %d %x",
      ioSequence, instructionSteps, s["cpu.a"], s["cpu.x"], s["cpu.y"], sp,
      s["cpu.d"], s["cpu.dbr"], s["cpu.ps"], s["cpu.k"], s["cpu.pc"], s["cpu.emulationMode"] and 1 or 0, raw))
  end, emu.callbackType.exec, 0x80C1E3, 0x80C1E3)
end
if MENU_INPUT then
  local owner, ownerFrames = false, 0
  emu.addMemoryCallback(function() owner = true end, emu.callbackType.exec, 0x80A139, 0x80A139)
  emu.addEventCallback(function()
    if owner then ownerFrames = ownerFrames + 1 end
  end, emu.eventType.endFrame)
  emu.addEventCallback(function()
    if completedNativeTarget > 0 and AFTER_NATIVE_TARGET_INPUT then emu.setInput(AFTER_NATIVE_TARGET_INPUT, 0); return end
    local press = owner and ownerFrames % 30 < 6
    -- Keep confirmation edges through the original introduction. Once its
    -- first notice returns, release Start so the first player call cannot
    -- open the status menu. Switch to the requested pad only after that
    -- actual control Native has returned, including any confirmation wait.
    local start = press and MENU_START ~= false and not (AFTER_NATIVE_TARGET_INPUT and completedNativeNmi)
    emu.setInput({a = press, start = start}, 0)
  end, emu.eventType.inputPolled)
end
local checkpointHits = 0
emu.addMemoryCallback(function()
  if not started or done then return end
  checkpointHits = checkpointHits + 1
  if checkpointHits < (STOP_HITS or 1) then return end
  if STOP_AFTER_NATIVE_NMI and not completedNativeNmi then return end
  if STOP_NATIVE_TARGET ~= 0 and completedNativeTarget < STOP_NATIVE_HITS then return end
  if CAPTURE_ROOM_FRAMES and roomFrames < 2 then return end
  checkpoint("F")
  flushPpuWindow()
  if CAPTURE_PPU then
    video()
  end
  out("STEPS " .. instructionSteps)
  out("HITS " .. checkpointHits)
  out("IO " .. ioSequence)
  out("NMI " .. nmis)
  done = true
  print("N " .. sequence)
  emu.stop(0)
end, emu.callbackType.exec, stopPc, stopPc)
