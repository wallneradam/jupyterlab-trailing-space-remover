# trailing-space-remover

Removes trailing spaces on before save from notebook cells and editors.

It can move cursors and selections to the expected place after space removal. It supports multicursors
and multi selections.

## Prerequisites

* JupyterLab

## Installation

```bash
jupyter labextension install @wallneradam/trailing_space_remover
```

## Development

For a development install (requires npm version 4 or later), do the following in the repository directory:

```bash
npm install
npm run build
jupyter labextension link .
```

To rebuild the package and the JupyterLab app:

```bash
npm run build
jupyter lab build
```
