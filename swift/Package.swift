// swift-tools-version:5.7
import PackageDescription

let package = Package(
    name: "EventReduce",
    products: [
        .library(name: "EventReduce", targets: ["EventReduce"])
    ],
    targets: [
        .target(name: "EventReduce"),
        .testTarget(name: "EventReduceTests", dependencies: ["EventReduce"]),
    ]
)
