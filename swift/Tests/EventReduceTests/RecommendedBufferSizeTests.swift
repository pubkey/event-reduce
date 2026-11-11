import EventReduce
import XCTest

final class RecommendedBufferSizeTests: XCTestCase {
    /// A negative limit is not valid, but it must not crash the process.
    func testNegativeLimit() {
        XCTAssertEqual(getRecommendedResultWindowBufferSize(-1), 0)
        XCTAssertEqual(getRecommendedResultWindowBufferSize(-400), 0)
        XCTAssertEqual(getRecommendedResultWindowBufferSize(Int.min), 0)
    }

    func testLimitsWithoutBuffer() {
        XCTAssertEqual(getRecommendedResultWindowBufferSize(nil), 0)
        XCTAssertEqual(getRecommendedResultWindowBufferSize(0), 0)
        XCTAssertEqual(getRecommendedResultWindowBufferSize(1), 0)
    }

    func testHugeLimit() {
        XCTAssertEqual(getRecommendedResultWindowBufferSize(Int.max), 30)
    }
}
