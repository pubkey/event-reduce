package eventreduce_test

import (
	"reflect"
	"testing"

	eventreduce "github.com/pubkey/event-reduce/go/v7"
)

// When the key document map is out of sync and does not have a document that is in the results,
// the actions must still find the document in the results, like the JavaScript implementation.
func TestKeyDocumentMapWithoutTheChangedDocument(t *testing.T) {
	a := doc{ID: "a", Age: 1}
	b := doc{ID: "b", Age: 2}
	params := queryParams(query{MinAge: 0})
	run := func(action eventreduce.ActionName, event eventreduce.ChangeEvent[doc]) ([]string, map[string]doc) {
		keyDocumentMap := map[string]doc{"b": b}
		results, err := eventreduce.RunAction(action, params, event, []doc{a, b}, keyDocumentMap)
		if err != nil {
			t.Fatal(err)
		}
		return ids(results), keyDocumentMap
	}

	results, keyDocumentMap := run(eventreduce.RemoveExisting, eventreduce.DeleteEvent("a", a))
	if !reflect.DeepEqual(results, []string{"b"}) || len(keyDocumentMap) != 1 {
		t.Errorf("removeExisting: got %v with %d map entries", results, len(keyDocumentMap))
	}

	changed := doc{ID: "a", Age: 1, Name: "changed"}
	results, keyDocumentMap = run(eventreduce.ReplaceExisting, eventreduce.UpdateEvent("a", changed, a))
	if !reflect.DeepEqual(results, []string{"a", "b"}) || keyDocumentMap["a"] != changed {
		t.Errorf("replaceExisting: got %v, map entry %v", results, keyDocumentMap["a"])
	}

	moved := doc{ID: "a", Age: 5}
	results, keyDocumentMap = run(eventreduce.RemoveExistingAndInsertAtSortPosition, eventreduce.UpdateEvent("a", moved, a))
	if !reflect.DeepEqual(results, []string{"b", "a"}) || keyDocumentMap["a"] != moved || len(keyDocumentMap) != 2 {
		t.Errorf("removeExistingAndInsertAtSortPosition: got %v with %d map entries", results, len(keyDocumentMap))
	}
}
