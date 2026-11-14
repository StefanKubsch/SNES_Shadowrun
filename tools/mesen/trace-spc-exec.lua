-- Test oracle only: every executed SPC700 instruction address with its
-- opcode and the address executed next, for FRAMES frames after power-on.
local prev, pairs_, frames = nil, {}, 0
emu.addMemoryCallback(function(address)
  if prev then
    local key = prev * 65536 + address
    if not pairs_[key] then pairs_[key] = true; print(string.format("E %04x %02x %04x", prev, emu.read(prev, emu.memType.spcMemory), address)) end
  end
  prev = address
end, emu.callbackType.exec, 0x0000, 0xFFFF, emu.cpuType.spc, emu.memType.spcMemory)
emu.addEventCallback(function()
  frames = frames + 1
  emu.setInput({a = frames % 60 < 6, start = frames % 120 < 6}, 0)
  if frames >= FRAMES then print("END " .. frames); emu.stop(0) end
end, emu.eventType.endFrame)
