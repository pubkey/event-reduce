"""
Resolves the action with the BDD of the JavaScript implementation.
Only the already generated BDD is used, it is not created or optimized here.

The BDD is a PackedBdd of the binary-decision-diagram npm package.

String format:
- The first char is the byte width of the entries: '1', '2' or '4'.
- The rest is the standard base64 of the little-endian entries.

Layout of the entries:
- Every non-leaf node takes three consecutive entries: [level, ref0, ref1]
  - level is the index of the state function in ORDERED_STATE_LIST
  - ref0 is followed when the state is false, ref1 when it is true
- The node with the id x starts at index 3 * x, the root node has the id 0.
- With n = len(entries) / 3, a reference r < n points to the node with the id r,
  r >= n is a leaf with the action index r - n in ORDERED_ACTION_LIST.
"""

from __future__ import annotations

import base64
from typing import Any

from .bdd_generated import PACKED_BDD_STRING
from .states import STATE_RESOLVE_FUNCTION_BY_INDEX
from .types import StateResolveFunctionInput


def packed_bdd_from_base64_string(packed: str) -> list[int]:
    width = int(packed[0])
    if width not in (1, 2, 4):
        raise ValueError(f"unknown byte width {width} of the packed BDD")
    data = base64.b64decode(packed[1:])
    return [int.from_bytes(data[i : i + width], "little") for i in range(0, len(data), width)]


PACKED_BDD: list[int] = packed_bdd_from_base64_string(PACKED_BDD_STRING)


def resolve_input(input: StateResolveFunctionInput[Any]) -> int:
    """Walks the BDD and returns the index of the action in ORDERED_ACTION_LIST."""
    bdd = PACKED_BDD
    fns = STATE_RESOLVE_FUNCTION_BY_INDEX
    n = len(bdd) // 3
    i = 0
    while True:
        ref = bdd[i + 2] if fns[bdd[i]](input) else bdd[i + 1]
        if ref >= n:
            return ref - n
        i = ref * 3
