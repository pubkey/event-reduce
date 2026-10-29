// swift-tools-version:5.7
// The Swift implementation is in ./swift, this manifest is at the root
// so the repository can be added as a Swift package, https://www.swift.org/documentation/package-manager/
import PackageDescription

let package = Package(
    name: "RxDBEventReduce",
    products: [
        .library(name: "RxDBEventReduce", targets: ["RxDBEventReduce"])
    ],
    targets: [
        .target(name: "RxDBEventReduce", path: "swift/Sources/RxDBEventReduce"),
        .testTarget(
            name: "RxDBEventReduceTests",
            dependencies: ["RxDBEventReduce"],
            path: "swift/Tests/RxDBEventReduceTests"
        ),
    ]
)
