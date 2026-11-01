import numpy as np

from eigora.qm.discrete import SZ

theta = 1.57
n_shots = 1000

# A spin pointing at angle theta from the z axis.
state = np.array([np.cos(theta / 2), np.sin(theta / 2)])

print("Born probabilities:")
for outcome in SZ.outcomes(state):
    print(f"  {outcome.value:+.0f}: {outcome.probability:.3f}")

rng = np.random.default_rng()
results = [SZ.measure(state, rng)[0].value for _ in range(n_shots)]

print(f"\nFraction of +1 in {n_shots} measurements: {np.mean(np.array(results) > 0):.3f}")
print(f"Average: {np.mean(results):+.3f}   Expectation value: {SZ.expectation(state):+.3f}")
