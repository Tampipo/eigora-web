import matplotlib.pyplot as plt

from eigora import GridND
from eigora.qm import QuantumSystem
from eigora.qm.potentials import HarmonicWell

omega = 1.0
n_states = 5

grid = GridND.line(-8.0, 8.0, 512)
system = QuantumSystem(grid=grid, potential=HarmonicWell(omega=omega))
solution = system.solve(n_states=n_states)
x = grid.values()

plt.plot(x, solution.potential, color="gray", label="V(x)")
for n, energy in enumerate(solution.energies):
    # Each state is drawn at the height of its own energy.
    plt.plot(x, energy + solution.wavefunctions[n], label=f"n = {n}")

plt.ylim(0, (n_states + 1) * omega)
plt.xlabel("x")
plt.ylabel("energy")
plt.legend()
plt.show()
