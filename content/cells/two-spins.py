import numpy as np

from eigora.qm.discrete import HeisenbergChain, SZ, embed

# Two coupled spins. Try coupling=-1.0, or add field=0.5.
chain = HeisenbergChain(n_sites=2)
print("Energies:", np.round(chain.eigenenergies(), 3))

dims = (2, 2)
total_sz = embed(SZ, 0, dims) + embed(SZ, 1, dims)
print("Total SZ:", np.round(total_sz.eigenvalues(), 3))

# Equal weights on |01> and |10>: one of the triplet states.
state = np.array([0.0, 1.0, 1.0, 0.0]) / np.sqrt(2)
print("Energy of this state:", round(chain.expectation(state), 3))
