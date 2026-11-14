-- OBJ time-over case (tools/obj-time-over-case.mjs): after ten frames print the
-- picture size and, per row, the runs of non-black colour as start-end:rrggbb.
local frames = 0
emu.addEventCallback(function()
  frames = frames + 1
  if frames < 10 then return end
  local size = emu.getScreenSize()
  local screen = emu.getScreenBuffer()
  print("SIZE " .. size.width .. " " .. size.height)
  for row = 0, size.height - 1 do
    local runs, last, start = {}, nil, 0
    for x = 0, size.width do
      local c = x < size.width and (screen[row * size.width + x + 1] & 0xFFFFFF) or -1
      if c ~= last then
        if last and last ~= 0 then runs[#runs + 1] = string.format("%d-%d:%06x", start, x - 1, last) end
        last, start = c, x
      end
    end
    if #runs > 0 then print("ROW " .. row .. " " .. table.concat(runs, " ")) end
  end
  emu.stop(0)
end, emu.eventType.endFrame)
