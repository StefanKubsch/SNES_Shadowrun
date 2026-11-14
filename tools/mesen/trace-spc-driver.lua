-- Test oracle only: what the original SPC program reads from and writes to its
-- I/O registers $F0-$FF, from power-on for FRAMES frames, with the input plan
-- of the room recording (A/Start pulses once the owner 80:A139 runs).
-- Lines (hex, " #n" sequence suffix):
--   R pc addr value cycle     read. Idle reads are left out:
--                             $FD at 0244 and $FE at 025F with value 0, $F4 at a
--                             driver token poll with value = ARAM[$1C].
--   W pc addr value dsp cycle write; dsp is the DSP address for $F3, else 0.
--   D frame cycle             ARAM (A lines) and DSP registers (G line) at the
--                             first main loop start 0244 after every SNAP-th frame.
--   V cycle mode/env/hidden/delay x8 counter everyOther   DSP voice state per frame.
--   X cycle voice x8 global   inner DSP state per frame (fields in VOICE_FIELDS and
--                             GLOBAL_FIELDS, "/"-separated; echoHistory0-15 last).
-- pc is the start of the executing SPC instruction; cycle is Mesen's SPC cycle
-- count (two per DSP clock, 64 per sample).
local sequence, frames, cur = 0, 0, 0
local snapPending, done = false, false
local function out(line) sequence = sequence + 1; print(line .. " #" .. sequence) end
local idlePoll = {[0x02A7] = true, [0x0625] = true, [0x0663] = true, [0x0358] = true, [0x0991] = true}
local spcRam, spcDsp = emu.memType.spcRam, emu.memType.spcDspRegisters
emu.addMemoryCallback(function(address)
  cur = address
  if snapPending and address == 0x0244 then
    snapPending = false
    out("D " .. frames .. " " .. string.format("%x", emu.getCpuCycleCount(emu.cpuType.spc)))
    local chunk = {}
    for i = 0, 65535 do
      chunk[#chunk + 1] = string.format("%02x", emu.read(i, spcRam))
      if #chunk == 4096 then out("A " .. (i - 4095) .. " " .. table.concat(chunk)); chunk = {} end
    end
    local regs = {}
    for i = 0, 127 do regs[#regs + 1] = string.format("%02x", emu.read(i, spcDsp)) end
    out("G " .. table.concat(regs))
  end
end, emu.callbackType.exec, 0x0000, 0xFFFF, emu.cpuType.spc, emu.memType.spcMemory)
emu.addMemoryCallback(function(address, value)
  if done then return end
  if value == 0 and (address == 0xFD and cur == 0x0244 or address == 0xFE and cur == 0x025F) then return end
  if address == 0xF4 and idlePoll[cur] and value == emu.read(0x1C, spcRam) then return end
  out(string.format("R %x %x %x %x", cur, address, value, emu.getCpuCycleCount(emu.cpuType.spc)))
end, emu.callbackType.read, 0x00F0, 0x00FF, emu.cpuType.spc, emu.memType.spcMemory)
emu.addMemoryCallback(function(address, value)
  if done then return end
  if address == 0xF3 then out(string.format("W %x %x %x %x %x", cur, address, value, emu.read(0xF2, spcRam), emu.getCpuCycleCount(emu.cpuType.spc)))
  else out(string.format("W %x %x %x 0 %x", cur, address, value, emu.getCpuCycleCount(emu.cpuType.spc))) end
end, emu.callbackType.write, 0x00F0, 0x00FF, emu.cpuType.spc, emu.memType.spcMemory)
local VOICE_FIELDS = {"brrAddress", "brrOffset", "bufferPos", "interpolationPos", "envOut"}
local GLOBAL_FIELDS = {"outSamples0", "outSamples1", "echoIn0", "echoIn1", "echoOut0", "echoOut1", "echoHistoryPos",
  "echoOffset", "echoLength", "echoPointer", "echoRingBufferAddress", "noiseLfsr", "voiceOutput", "outRegBuffer",
  "envRegBuffer", "voiceEndBuffer", "looped", "pitch", "brrData", "brrHeader", "brrNextAddress", "sourceNumber",
  "sampleAddress", "dirSampleTableAddress", "echoOn", "noiseOn", "pitchModulationOn", "keyOn", "keyOff", "newKeyOn",
  "adsr1", "step", "echoEnabled"}
local function num(v) if v == true then return 1 elseif v == false then return 0 else return v end end
local function inner(s)
  local parts = {}
  for v = 0, 7 do
    local p, f = "spc.dsp.voices[" .. v .. "].", {}
    for _, k in ipairs(VOICE_FIELDS) do f[#f + 1] = num(s[p .. k]) end
    for i = 0, 11 do f[#f + 1] = s[p .. "sampleBuffer" .. i] end
    parts[#parts + 1] = table.concat(f, "/")
  end
  local g = {}
  for _, k in ipairs(GLOBAL_FIELDS) do g[#g + 1] = num(s["spc.dsp." .. k]) end
  for i = 0, 15 do g[#g + 1] = s["spc.dsp.echoHistory" .. i] end
  parts[#parts + 1] = table.concat(g, "/")
  return table.concat(parts, " ")
end
local owner, ownerFrames = false, 0
emu.addMemoryCallback(function() owner = true end, emu.callbackType.exec, 0x80A139, 0x80A139)
emu.addEventCallback(function()
  local press = owner and ownerFrames % 30 < 6
  emu.setInput({a = press, start = press}, 0)
end, emu.eventType.inputPolled)
emu.addEventCallback(function()
  if done then return end
  if owner then ownerFrames = ownerFrames + 1 end
  frames = frames + 1
  local s = emu.getState()
  local parts = {}
  for v = 0, 7 do
    local p = "spc.dsp.voices[" .. v .. "]."
    parts[#parts + 1] = string.format("%d/%d/%d/%d", s[p .. "envMode"] or -1, s[p .. "envVolume"], s[p .. "prevCalculatedEnv"], s[p .. "keyOnDelay"])
  end
  out(string.format("V %x %s %d %d", emu.getCpuCycleCount(emu.cpuType.spc), table.concat(parts, " "), s["spc.dsp.counter"], num(s["spc.dsp.everyOtherSample"])))
  out(string.format("X %x %s", emu.getCpuCycleCount(emu.cpuType.spc), inner(s)))
  if frames % SNAP == 0 then snapPending = true end
  if frames >= FRAMES then done = true; print("N " .. sequence); emu.stop(0) end
end, emu.eventType.endFrame)
