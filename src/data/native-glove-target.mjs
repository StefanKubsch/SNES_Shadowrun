// 9C40: an object is out of reach from a summed X/Y distance or a height distance of 81
// on; the notice 02/02/0C/03 then shows text 0 for 3C frames (FEC1).
export const GLOVE_REACH = 0x81;

export const OUT_OF_REACH_NOTICE = Object.freeze({ left: 2, columns: 0x0c, rows: 3, frames: 0x3c });
