export async function settleParallelTasks<T>(
  tasks: Array<() => Promise<T>>
): Promise<T[]> {
  const results = await Promise.allSettled(tasks.map((task) => task()));
  const failure = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected"
  );

  if (failure) {
    throw failure.reason;
  }

  return results.map((result) => (result as PromiseFulfilledResult<T>).value);
}
