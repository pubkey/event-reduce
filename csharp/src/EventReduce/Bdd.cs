using System;

namespace EventReduce
{
    // The BDD is shared with the JavaScript implementation as a PackedBdd
    // of the binary-decision-diagram npm package.
    //
    // String format:
    // - The first char is the byte width of the entries: '1', '2' or '4'.
    // - The rest is the standard base64 of the little-endian entries.
    //
    // Layout of the entries:
    // - Every non-leaf node takes three consecutive entries: [level, ref0, ref1]
    //   - level is the index of the state function in OrderedStateList
    //   - ref0 is followed when the state is false, ref1 when it is true
    // - The node with the id x starts at index 3 * x, the root node has the id 0.
    // - With n = entries.Length / 3, a reference r < n points to the node with the id r,
    //   r >= n is a leaf with the action index r - n in OrderedActionList.

    /// <summary>Resolves the action with the BDD.</summary>
    public static class Bdd
    {
        /// <summary>The decoded entries of <see cref="BddGenerated.PackedBddString"/>.</summary>
        public static readonly int[] PackedBdd = PackedBddFromBase64String(BddGenerated.PackedBddString);

        /// <summary>Decodes a packed BDD string.</summary>
        public static int[] PackedBddFromBase64String(string str)
        {
            var width = str[0] - '0';
            if (width != 1 && width != 2 && width != 4)
            {
                throw new ArgumentException("unknown byte width " + width + " of the packed BDD");
            }
            var bytes = Convert.FromBase64String(str.Substring(1));
            var entries = new int[bytes.Length / width];
            for (var i = 0; i < entries.Length; i++)
            {
                var value = 0;
                for (var b = 0; b < width; b++)
                {
                    value |= bytes[i * width + b] << (8 * b);
                }
                entries[i] = value;
            }
            return entries;
        }

        /// <summary>Walks the BDD and returns the index of the action in OrderedActionList.</summary>
        public static int ResolveInput<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var bdd = PackedBdd;
            var n = bdd.Length / 3;
            var i = 0;
            while (true)
            {
                var reference = bdd[States.ResolveStateByIndex(bdd[i], input) ? i + 2 : i + 1];
                if (reference >= n)
                {
                    return reference - n;
                }
                i = reference * 3;
            }
        }
    }
}
