namespace RxDB.EventReduce
{
    // The BDD is shared with the JavaScript implementation as a PackedBdd
    // of the binary-decision-diagram npm package, see BddGenerated.PackedBdd.
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
        /// <summary>Walks the BDD and returns the index of the action in OrderedActionList.</summary>
        public static int ResolveInput<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var bdd = BddGenerated.PackedBdd;
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
