# Copyright (C) 2026 Tanguy Marsault - Eigora
# SPDX-License-Identifier: AGPL-3.0-or-later

"""
What a tutorial cell runs inside.

Runs each cell in a fresh namespace and returns what it printed and drew. Plots
come from the real matplotlib, which is only imported for cells that use it
because it is slow to start and adds to the download. Each figure comes back as
a PNG.
"""

import base64
import io
import json
import os
import sys
import traceback
import warnings

os.environ["MPLBACKEND"] = "agg"

MAX_FIGURES = 4
DPI = 150
# Figures are scaled down to this, so that figsize=(1000, 1000) can't exhaust memory.
MAX_INCHES = 14

_TEXT = "#8f98a9"
_THEME = {
    "figure.constrained_layout.use": True,
    "figure.figsize": (7, 4),
    "savefig.transparent": True,
    "text.color": _TEXT,
    "axes.labelcolor": _TEXT,
    "axes.titlecolor": "#e8ebf2",
    "axes.edgecolor": "#343c4d",
    "axes.grid": True,
    "grid.color": "#232936",
    "xtick.color": _TEXT,
    "ytick.color": _TEXT,
    "legend.frameon": False,
}
_COLORS = ["#7ca0ff", "#ffa078", "#78dcb4", "#e8a0d2", "#aa8dff"]

_images = []


class CellLimitError(RuntimeError):
    """The cell asked for more output than a page will draw."""


def _collect_figures():
    """Save every open figure to the output and close it."""
    import matplotlib.pyplot as plt

    for number in plt.get_fignums():
        if len(_images) >= MAX_FIGURES:
            plt.close("all")
            raise CellLimitError(f"a cell can draw at most {MAX_FIGURES} figures")
        figure = plt.figure(number)
        width, height = figure.get_size_inches()
        figure.set_size_inches(
            width * min(1, MAX_INCHES / max(width, height)),
            height * min(1, MAX_INCHES / max(width, height)),
        )
        buffer = io.BytesIO()
        with warnings.catch_warnings():
            # Raised inside matplotlib's own text drawing, so it would mean
            # nothing to the reader. Warnings from their code still show.
            warnings.filterwarnings("ignore", message="The [xy] parameter as float")
            figure.savefig(buffer, format="png", dpi=DPI)
        _images.append(base64.b64encode(buffer.getvalue()).decode("ascii"))
        plt.close(figure)


def prepare(source):
    """Import what a cell needs. Separate so the time limit doesn't count this."""
    if "matplotlib" not in source:
        return
    import matplotlib
    import matplotlib.pyplot as plt

    plt.close("all")
    matplotlib.rcdefaults()
    matplotlib.rcParams.update(_THEME)
    matplotlib.rcParams["axes.prop_cycle"] = matplotlib.cycler(color=_COLORS)
    plt.show = lambda *_args, **_kwargs: _collect_figures()


def _describe_error():
    """The traceback from the reader's code down, without this file's frames."""
    kind, error, tb = sys.exc_info()
    while tb is not None and tb.tb_frame.f_code.co_filename != "<cell>":
        tb = tb.tb_next
    return "".join(traceback.format_exception(kind, error, tb))


def run_cell(source):
    """Run one cell. Returns JSON: figures as base64 PNGs, and any error."""
    _images.clear()
    error = None
    try:
        exec(compile(source, "<cell>", "exec"), {"__name__": "__main__"})
        # A figure with no plt.show() still appears, as in a notebook.
        if "matplotlib.pyplot" in sys.modules:
            _collect_figures()
    except BaseException:  # SystemExit and KeyboardInterrupt must not kill the worker
        error = _describe_error()
    return json.dumps({"figures": _images, "error": error})
