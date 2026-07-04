# Java — stack reference

Read this after Step 0 of `SKILL.md` has determined the architecture shape and that Java is the chosen language. This file covers the now-standard concurrency model (a major recent shift), framework conventions, the data layer, and testing. The Step 1 engineering bars in `SKILL.md` still apply — this file adds the Java-specific *how*.

## Framework: Spring Boot is the default

Spring Boot remains the dominant choice for Java backends — large ecosystem, dependency injection, mature tooling, and the deepest hiring pool for enterprise Java work. There's no equivalent multi-way split here the way there is in Go or Node — reach for something else (Micronaut, Quarkus) only for a specific reason like faster cold-start in a serverless/container context, not as a default alternative.

## Concurrency: Virtual threads are now the default for new projects

**This is the single most important shift in current Java backend development, and it changes the default answer to "how does this scale."** Virtual threads, stabilized in Java 21 (Project Loom) and natively supported from Spring Boot 3.2+, let you write ordinary blocking code (standard JDBC, standard `RestTemplate`/`HttpClient` calls) while getting much of the scalability that used to require reactive programming (WebFlux/Project Reactor).

```yaml
# application.yml — enable virtual threads in Spring Boot 3.2+
spring:
  threads:
    virtual:
      enabled: true
```

- **For a new project with no existing reactive investment, default to Spring MVC + virtual threads, not WebFlux.** Virtual threads give most of the I/O-concurrency benefit reactive programming was solving for, without WebFlux's steeper learning curve and more complex debugging/error-handling model.
- **If a project is already on WebFlux and it's working well, there's no urgency to migrate** — this is a "don't fix what isn't broken" situation, not a mandate to rewrite.
- **Use standard JDBC/JPA with virtual threads, not R2DBC.** R2DBC was built specifically for the reactive model; pairing it with virtual threads adds complexity without a corresponding benefit, since virtual threads already make blocking JDBC calls scale well.
- **Set `spring.jpa.open-in-view=false`.** Open Session in View holds a database connection open for the entire HTTP request lifecycle — always a questionable default, but with virtual threads enabling much higher request concurrency, this anti-pattern can exhaust the connection pool far faster than it would under the old platform-thread model.

### The critical gotcha: thread pinning

A virtual thread that enters a `synchronized` block and then performs blocking I/O inside it **cannot be unmounted from its underlying carrier (platform) thread** — this is called pinning, and it silently defeats the entire scalability benefit virtual threads are supposed to provide. With enough pinned virtual threads, the small pool of carrier threads gets exhausted and the application sees unexplained latency spikes that look like a totally different problem.

- **Common causes**: `synchronized` blocks or methods in application code, some JDBC drivers, and legacy libraries that predate virtual threads.
- **Detect it** by running with `-Djdk.tracePinnedThreads=full`, which prints a stack trace every time pinning occurs — use this proactively during load testing on any new virtual-thread-enabled service, not just when something's already gone wrong.
- **The fix**: replace `synchronized` with `java.util.concurrent.locks.ReentrantLock` where the lock genuinely needs to span a blocking call — a `ReentrantLock` allows the virtual thread to be unmounted while waiting, where `synchronized` does not.

```java
// PINS the virtual thread — blocking I/O happens while inside a synchronized block
public synchronized void updateCache(String key, String value) {
    externalService.notify(key, value); // blocks the carrier thread here
    cache.put(key, value);
}

// Does NOT pin — ReentrantLock allows unmounting during the blocking call
private final ReentrantLock lock = new ReentrantLock();
public void updateCache(String key, String value) {
    lock.lock();
    try {
        externalService.notify(key, value); // virtual thread can unmount while waiting
        cache.put(key, value);
    } finally {
        lock.unlock();
    }
}
```

### Connection pool sizing changes under virtual threads

Because virtual threads let an application handle far more concurrent requests than the old platform-thread model, **the database connection pool becomes the bottleneck much sooner than before** — size HikariCP's pool to what the database can actually sustain (commonly in the 20-100 connection range per database instance), not to the number of concurrent virtual threads, which can be in the thousands. If concurrent demand on the database genuinely exceeds what the pool can handle, the queuing should happen at the connection pool / a semaphore in front of it — not by accidentally over-provisioning a pool size the database can't actually support.

## Data layer

- **Spring Data JPA** remains the standard ORM layer, built on Hibernate. Use repository interfaces (`JpaRepository<Entity, IdType>`) for standard CRUD, and custom `@Query` methods or the Criteria API for anything beyond simple cases.
- **The N+1 query problem is the most common JPA performance issue** — fetching a collection and then lazily loading each item's associations one at a time instead of in a single join. Use `@EntityGraph` or explicit `JOIN FETCH` in a custom query to load associations eagerly and deliberately where they'll actually be needed, rather than leaving lazy loading to trigger N+1 queries silently.
- Use DTO projections (interface-based or constructor-based projections) for read-heavy endpoints that don't need the full entity graph — pulling back a full entity with all its lazy associations when only two fields are actually needed in the response wastes both query time and memory.
- Pair with **Flyway** or **Liquibase** for schema migrations — both are mature, widely used, and integrate cleanly with Spring Boot's startup lifecycle. Review generated/written migrations the same way as any other stack in this skill — an automatic schema diff tool getting a rename wrong is a recurring failure mode across every ecosystem covered here, not just this one.

## Testing

- **JUnit 5** is the standard test framework, with **Mockito** for mocking dependencies.
- **`@SpringBootTest`** loads the full application context for true integration tests — use it deliberately, not as the default for every test, since it's meaningfully slower than a focused unit test or a slice test.
- **Test slices** (`@WebMvcTest`, `@DataJpaTest`) load only the relevant part of the Spring context — prefer these over a full `@SpringBootTest` when the test genuinely only needs, say, the web layer or the JPA layer, to keep the test suite fast.
- **Testcontainers** is the standard way to run integration tests against a real database engine (Postgres, MySQL, etc. in a real container) rather than an in-memory substitute like H2 — the same principle as every other stack in this skill: a substitute database can pass while missing real-engine-specific behavior that only an integration test against the actual engine would catch.
- When testing virtual-thread-enabled code under load, JMeter (or a similar load-testing tool) comparing virtual-thread vs. platform-thread configurations is the practical way to verify the expected scalability gain actually shows up for a given workload, rather than assuming it from the feature being enabled.

## Anti-patterns to flag in review

- `synchronized` wrapping a blocking I/O call in a virtual-thread-enabled service — causes carrier-thread pinning and silently defeats the scalability benefit.
- `spring.jpa.open-in-view` left at its default (`true`) in a virtual-thread-enabled service, holding DB connections open for the full request duration under much higher concurrency than before.
- A HikariCP pool sized to match expected virtual-thread concurrency rather than to what the database can actually sustain.
- Lazy-loaded JPA associations triggering N+1 queries in a hot path, with no `@EntityGraph`/`JOIN FETCH` to address it.
- Reaching for WebFlux on a new project by habit when virtual threads + Spring MVC would meet the same concurrency need with a simpler programming model.
- R2DBC paired with virtual threads — added complexity solving a problem virtual threads already solve more simply with standard JDBC.
- A `@SpringBootTest` used for something a `@WebMvcTest` or `@DataJpaTest` slice would cover just as well, slowing the test suite unnecessarily.
