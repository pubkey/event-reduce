import com.vanniktech.maven.publish.JavadocJar
import com.vanniktech.maven.publish.KotlinJvm
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm") version "2.4.21"
    id("com.vanniktech.maven.publish") version "0.37.0"
}

// the Maven Central namespace, verified with the domain rxdb.info
group = "info.rxdb"
version = "7.4.1"

repositories {
    mavenCentral()
}

dependencies {
    testImplementation(kotlin("test"))
    testImplementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.12.0")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    explicitApi()
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
        allWarningsAsErrors.set(true)
    }
}

tasks.test {
    useJUnitPlatform()
}

// Published to Maven Central on every release, see .github/workflows/release.yml
mavenPublishing {
    configure(KotlinJvm(javadocJar = JavadocJar.Empty(), sourcesJar = true))
    publishToMavenCentral()
    signAllPublications()
    coordinates(group.toString(), "event-reduce", version.toString())
    pom {
        name.set("event-reduce")
        description.set("Update live query results from database change events without re-running the query.")
        url.set("https://github.com/pubkey/event-reduce")
        licenses {
            license {
                name.set("MIT License")
                url.set("https://opensource.org/licenses/MIT")
            }
        }
        developers {
            developer {
                id.set("pubkey")
                name.set("Daniel Meyer")
                url.set("https://github.com/pubkey")
            }
        }
        scm {
            url.set("https://github.com/pubkey/event-reduce")
            connection.set("scm:git:https://github.com/pubkey/event-reduce.git")
            developerConnection.set("scm:git:ssh://git@github.com/pubkey/event-reduce.git")
        }
    }
}
