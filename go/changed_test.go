package eventreduce_test

import (
	"math"
	"testing"

	eventreduce "github.com/pubkey/event-reduce/go/v8"
)

type scoreDoc struct {
	ID    string
	Score float64
}

func scoreBuffer(t *testing.T, rows []scoreDoc) *eventreduce.ResultWindowBuffer[scoreDoc] {
	buffer, err := eventreduce.NewResultWindowBuffer(eventreduce.QueryParams[scoreDoc]{
		GetDocumentID: func(d scoreDoc) string { return d.ID },
		Limit:         eventreduce.Int(5),
		QueryMatcher:  func(d scoreDoc) bool { return true },
		SortComparator: func(a, b scoreDoc) int {
			if a.ID < b.ID {
				return -1
			}
			return 1
		},
		SortFieldsChanged: func(previous, d scoreDoc) bool { return false },
	}, 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	buffer.Reset(rows)
	return buffer
}

// NaN is not equal to itself, so a row with a NaN value is never equal to itself for reflect.DeepEqual.
// Such a row must not make the results look changed when no change event was about it.
func TestChangedWithARowThatIsNotEqualToItself(t *testing.T) {
	nan := scoreDoc{ID: "a", Score: math.NaN()}
	b := scoreDoc{ID: "b", Score: 1}
	buffer := scoreBuffer(t, []scoreDoc{nan, b})

	if result := buffer.ApplyChangeEvents(nil); result.RunFullQueryAgain || result.Changed {
		t.Errorf("no events: got %+v, want not changed", result)
	}
	// an event about a row that is not in the results
	result := buffer.ApplyChangeEvents([]eventreduce.ChangeEvent[scoreDoc]{
		eventreduce.DeleteEvent("z", scoreDoc{ID: "z"}),
	})
	if result.RunFullQueryAgain || result.Changed {
		t.Errorf("event about another row: got %+v, want not changed", result)
	}
	// an event that changes the other row
	result = buffer.ApplyChangeEvents([]eventreduce.ChangeEvent[scoreDoc]{
		eventreduce.UpdateEvent("b", scoreDoc{ID: "b", Score: 2}, b),
	})
	if result.RunFullQueryAgain || !result.Changed {
		t.Errorf("update of b: got %+v, want changed", result)
	}
}

func TestChangedStillComparesTheRowsOfTheEvents(t *testing.T) {
	a := scoreDoc{ID: "a", Score: 1}
	buffer := scoreBuffer(t, []scoreDoc{a})
	// an update that changes nothing
	result := buffer.ApplyChangeEvents([]eventreduce.ChangeEvent[scoreDoc]{eventreduce.UpdateEvent("a", a, a)})
	if result.RunFullQueryAgain || result.Changed {
		t.Errorf("update without a change: got %+v, want not changed", result)
	}
	result = buffer.ApplyChangeEvents([]eventreduce.ChangeEvent[scoreDoc]{
		eventreduce.InsertEvent("b", scoreDoc{ID: "b", Score: 2}),
	})
	if result.RunFullQueryAgain || !result.Changed || len(result.Results) != 2 {
		t.Errorf("insert: got %+v, want changed", result)
	}
}
