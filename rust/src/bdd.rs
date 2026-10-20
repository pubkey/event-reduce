use std::hash::Hash;

use crate::states::resolve_state_by_index;
use crate::types::StateResolveFunctionInput;

pub use crate::bdd_generated::PACKED_BDD_STRING;

/*

The BDD is shared with the JavaScript implementation as a PackedBdd
of the binary-decision-diagram npm package.

String format:
- The first char is the byte width of the entries, only '1' is supported here.
- The rest is the standard base64 of the entries.

Layout of the entries:
- Every non-leaf node takes three consecutive entries: [level, ref0, ref1]
  - level is the index of the state function in ORDERED_STATE_LIST
  - ref0 is followed when the state is false, ref1 when it is true
- The node with the id x starts at index 3 * x, the root node has the id 0.
- With n = entries.len() / 3, a reference r < n points to the node with the id r,
  r >= n is a leaf with the action index r - n in ORDERED_ACTION_LIST.

The string is decoded at compile time.

*/

const fn base64_value(c: u8) -> u32 {
    match c {
        b'A'..=b'Z' => (c - b'A') as u32,
        b'a'..=b'z' => (c - b'a') as u32 + 26,
        b'0'..=b'9' => (c - b'0') as u32 + 52,
        b'+' => 62,
        b'/' => 63,
        _ => panic!("invalid base64 char in PACKED_BDD_STRING"),
    }
}

const fn decoded_len(s: &str) -> usize {
    let bytes = s.as_bytes();
    if bytes[0] != b'1' {
        panic!("only a PACKED_BDD_STRING with a byte width of 1 is supported");
    }
    let mut len = bytes.len() - 1;
    while len > 0 && bytes[len] == b'=' {
        len -= 1;
    }
    len * 3 / 4
}

const fn decode<const N: usize>(s: &str) -> [u8; N] {
    let bytes = s.as_bytes();
    let mut out = [0u8; N];
    let mut buffer: u32 = 0;
    let mut bits = 0;
    let mut i = 1;
    let mut o = 0;
    while i < bytes.len() && bytes[i] != b'=' {
        buffer = (buffer << 6) | base64_value(bytes[i]);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out[o] = ((buffer >> bits) & 0xFF) as u8;
            o += 1;
        }
        i += 1;
    }
    out
}

const PACKED_BDD_LEN: usize = decoded_len(PACKED_BDD_STRING);
pub const PACKED_BDD: [u8; PACKED_BDD_LEN] = decode(PACKED_BDD_STRING);

/// Walks the BDD and returns the index of the action in ORDERED_ACTION_LIST.
pub fn resolve_input<D, K: Eq + Hash>(input: &StateResolveFunctionInput<D, K>) -> usize {
    let n = PACKED_BDD.len() / 3;
    let mut i = 0;
    loop {
        let reference = if resolve_state_by_index(PACKED_BDD[i], input) {
            PACKED_BDD[i + 2]
        } else {
            PACKED_BDD[i + 1]
        } as usize;
        if reference >= n {
            return reference - n;
        }
        i = reference * 3;
    }
}
