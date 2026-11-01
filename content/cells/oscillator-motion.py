import numpy as np
import matplotlib.pyplot as plt

from eigora import GridND
from eigora.qm import QuantumSystem
from eigora.qm.potentials import HarmonicWell
from eigora.qm.states import GaussianWavepacket

omega = 1.0
well = HarmonicWell(omega=omega)
# Try another sigma: at any other width, the packet also breathes.
packet = GaussianWavepacket(x0=-4.0, k0=0.0, sigma=well.coherent_width)

grid = GridND.line(-12.0, 12.0, 512)
system = QuantumSystem(grid=grid, potential=well)
evolution = system.evolve(packet, t_max=4 * np.pi, dt=0.01, n_frames=120)
x = grid.values()

densities = np.abs(evolution.psi) ** 2
dx = grid.spacing[0]
mean_x = (densities * x).sum(axis=1) * dx

plt.plot(evolution.times, mean_x, label="<x>(t), simulation")
plt.plot(evolution.times, -4.0 * np.cos(omega * evolution.times),
         linestyle="--", color="gray", label="classical trajectory")
plt.xlabel("t")
plt.ylabel("position")
plt.legend()
plt.show()
