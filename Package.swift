// swift-tools-version:5.7
// The Swift implementation is in ./swift, this manifest is at the root
// so the repository can be added as a Swift package, https://www.swift.org/documentation/package-manager/
import PackageDescription

let package = Package(
    name: "EventReduce",
    products: [
        .library(name: "EventReduce", targets: ["EventReduce"])
    ],
    targets: [
        .target(name: "EventReduce", path: "swift/Sources/EventReduce"),
        .testTarget(
            name: "EventReduceTests",
            dependencies: ["EventReduce"],
            path: "swift/Tests/EventReduceTests"
        ),
    ]
)
