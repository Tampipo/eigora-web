import numpy as np
import matplotlib.pyplot as plt

from eigora import GridND
from eigora.qm import QuantumSystem
from eigora.qm.potentials import Potential


class TiltedWell(Potential):
    """Any callable V(x) works: subclass Potential and write the formula."""

    def __call__(self, x):
        return 0.1 * x**4 - x**2 + 0.2 * x


grid = GridND.line(-6.0, 6.0, 512)
system = QuantumSystem(grid=grid, potential=TiltedWell())
solution = system.solve(n_states=4)
x = grid.values()

plt.plot(x, solution.potential, color="gray", label="V(x)")
for n, energy in enumerate(solution.energies):
    plt.plot(x, energy + solution.wavefunctions[n], label=f"E = {energy:.3f}")

plt.ylim(-4, 2)
plt.xlabel("x")
plt.ylabel("energy")
plt.legend()
plt.show()
