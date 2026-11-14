-- Test oracle only: cold reset, one pad word per NMI from PADS (counted from
-- the first NMI after 00:E382, lag NMIs included), no game state writes.
-- "SHOT k scanline width height rgb" is the picture at the end of the frame
-- before NMI k for each k in SHOTS (taken outside the NMI, like
-- trace-live-room.lua). After the last picture: "N count" and stop.
local started, nmis, inNmi, sequence, remaining = false, 0, false, 0, 0
for _ in pairs(SHOTS) do remaining = remaining + 1 end
local function out(line) sequence = sequence + 1; print(line .. " #" .. sequence) end
local BITS = {b = 0x8000, y = 0x4000, select = 0x2000, start = 0x1000, up = 0x0800, down = 0x0400,
  left = 0x0200, right = 0x0100, a = 0x0080, x = 0x0040, l = 0x0020, r = 0x0010}
for _, bank in ipairs({0, 0x800000}) do
  emu.addMemoryCallback(function() started = true end, emu.callbackType.exec, bank + 0xE382, bank + 0xE382)
  emu.addMemoryCallback(function()
    if not started then return end
    if inNmi then error("Nested NMI") end
    inNmi = true; nmis = nmis + 1
  end, emu.callbackType.exec, bank + 0xC112, bank + 0xC112)
  emu.addMemoryCallback(function() if started then inNmi = false end end, emu.callbackType.exec, bank + 0xC14E, bank + 0xC14E)
end
emu.addEventCallback(function()
  -- The pad of the NMI that this auto-read belongs to.
  local k = inNmi and nmis - 1 or nmis
  local pad, input = PADS[k + 1] or 0, {}
  for name, bit in pairs(BITS) do input[name] = (pad & bit) ~= 0 end
  emu.setInput(input, 0)
end, emu.eventType.inputPolled)
emu.addEventCallback(function()
  if not started or inNmi or not SHOTS[nmis] then return end
  local size, rgb = emu.getScreenSize(), {}
  local screen = emu.getScreenBuffer()
  for i = 1, #screen do rgb[#rgb + 1] = string.format("%06x", screen[i] & 0xFFFFFF) end
  out("SHOT " .. nmis .. " " .. emu.getState()["ppu.scanline"] .. " " .. size.width .. " " .. size.height .. " " .. table.concat(rgb))
  SHOTS[nmis] = nil; remaining = remaining - 1
  if remaining == 0 then print("N " .. sequence); emu.stop(0) end
end, emu.eventType.endFrame)
