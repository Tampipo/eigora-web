import matplotlib.pyplot as plt

from eigora import GridND
from eigora.qm import QuantumSystem
from eigora.qm.potentials import RectangularBarrier
from eigora.qm.scattering import energy_averaged_transmission
from eigora.qm.states import GaussianWavepacket

height = 1.5
k0 = 1.5

barrier = RectangularBarrier(height=height, width=1.0)
packet = GaussianWavepacket(x0=-15.0, k0=k0, sigma=3.0)
grid = GridND.line(-50.0, 50.0, 1024)
system = QuantumSystem(grid=grid, potential=barrier)

t_max = 30.0 / k0
evolution = system.evolve(packet, t_max=t_max, dt=0.01, n_frames=4)
x = grid.values()

for frame, t in enumerate(evolution.times):
    plt.plot(x, evolution.probability_density(frame), label=f"t = {t:.1f}")
plt.plot(x, 0.05 * evolution.potential / height, color="gray", label="barrier")
plt.xlim(-30, 30)
plt.xlabel("x")
plt.ylabel("probability density")
plt.legend()
plt.show()

last = evolution.probability_density(evolution.n_frames - 1)
dx = grid.spacing[0]
print(f"transmitted (simulation): {last[x > 0].sum() * dx:.3f}")
print(f"transmitted (exact):      {energy_averaged_transmission(barrier, packet):.3f}")
