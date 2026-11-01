import numpy as np
import matplotlib.pyplot as plt

from eigora.qm.discrete import Rabi, evolve

detuning = 0.0
rabi_frequency = 1.0

system = Rabi(detuning=detuning, rabi_frequency=rabi_frequency)
times = np.linspace(0.0, 20.0, 400)
evolution = evolve(system, np.array([1.0, 0.0]), times)

# The probability of having left the initial state |0>.
excited = np.abs(evolution.psi[:, 1]) ** 2

plt.plot(times, excited, label="transfer probability")
plt.axhline(system.max_transfer, color="gray", linestyle="--", label="max_transfer")
plt.ylim(0, 1.05)
plt.xlabel("t")
plt.ylabel("probability")
plt.legend()
plt.show()
