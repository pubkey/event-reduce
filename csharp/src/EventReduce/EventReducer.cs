using System.Collections.Generic;

namespace EventReduce
{
    /// <summary>The main entry points of EventReduce.</summary>
    public static class EventReducer
    {
        /// <summary>
        /// Returns the action that transforms the previous results into the new results.
        /// If it is <see cref="ActionName.RunFullQueryAgain"/>, the query must be run over the database again.
        /// </summary>
        public static ActionName CalculateActionName<TDoc>(StateResolveFunctionInput<TDoc> input) =>
            Actions.OrderedActions[Bdd.ResolveInput(input)];

        /// <summary>
        /// Applies the action to the results.
        /// For performance reasons, it mutates <paramref name="previousResults"/>
        /// and the <paramref name="keyDocumentMap"/> and returns the mutated results.
        /// Throws an <see cref="EventReduceException"/> for RunFullQueryAgain and UnknownAction.
        /// </summary>
        public static List<TDoc> RunAction<TDoc>(
            ActionName action,
            QueryParams<TDoc> queryParams,
            ChangeEvent<TDoc> changeEvent,
            List<TDoc> previousResults,
            Dictionary<string, TDoc>? keyDocumentMap = null)
        {
            Actions.Run(action, new StateResolveFunctionInput<TDoc>(queryParams, changeEvent, previousResults, keyDocumentMap));
            return previousResults;
        }
    }
}
