from eigora import GridND
from eigora.qm import QuantumSystem
from eigora.qm.potentials import HarmonicWell

omega = 1.0

grid = GridND.line(-10.0, 10.0, 512)
system = QuantumSystem(grid=grid, potential=HarmonicWell(omega=omega))
solution = system.solve(n_states=5)

print(" n   numerical      exact")
for n, energy in enumerate(solution.energies):
    print(f"{n:2d}   {energy:9.5f}  {(n + 0.5) * omega:9.5f}")
