const PLUGIN_NAME = "trailing_space_remover";

import { IDisposable, DisposableDelegate } from '@phosphor/disposable';
import { JupyterFrontEnd, JupyterFrontEndPlugin } from "@jupyterlab/application";
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { NotebookPanel, INotebookModel, Notebook } from '@jupyterlab/notebook';
import { CodeCell } from '@jupyterlab/cells';
import { CodeEditor } from "@jupyterlab/codeeditor";


class RemoveTrailingSpaceExtension implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel> {
    private notebook: Notebook;
    // This will store the needed new positions of the selections between save start and end
    private newCellSelectionPositions: Array<{ start: number, end: number }[]> = [];

    createNew(panel: NotebookPanel, context: DocumentRegistry.IContext<INotebookModel>): IDisposable {
        // The content of the notebook panel will be the actoual notebook object
        this.notebook = panel.content;
        // Connect to save(State) signal, to be able to detect document save event
        context.saveState.connect(this.onSave, this);

        // Return an empty disposable, because we don't create any object
        return new DisposableDelegate(() => { });
    }

    // Save event handler
    private onSave(context: DocumentRegistry.IContext<INotebookModel>, state: DocumentRegistry.SaveState) {
        // Before save
        if (state == 'started') {
            // Empty the selection positions for sure
            this.newCellSelectionPositions = [];

            for (let cell of this.notebook.widgets) {
                // Go through all cells of the notebook
                if (cell instanceof CodeCell) {
                    let t = cell.model.value.text;
                    let p = 0, o = 0;
                    let newSelectionPositions: { start: number, end: number }[] = [];

                    // Iterate over all selections the cell have (multicursor)
                    for (let selection of cell.editor.getSelections()) {
                        // Get start and end offset of the selection
                        let os = cell.editor.getOffsetAt(selection.start);
                        let oe = cell.editor.getOffsetAt(selection.end);

                        let sl = t.slice(p, os);  // left
                        let sr = t.slice(os);  // right
                        let r = /[\t ]+(\n)/g;  // the regex we use

                        // If we have trailing spaces next to caret
                        let mr = sr.match(/^[\t ]*(?:\n|$)/);
                        if (mr) {
                            o += mr[0].length - (mr[0].slice(-1) == '\n' ? 1 : 0);
                            r = /[\t ]+(\n|$)/g;  // include line end as well
                        }
                        // Check the difference in length
                        let ss = sl.replace(r, '$1');
                        o += sl.length - ss.length;
                        // The new start offset
                        let nos = os - o;

                        // If we have a selection, not just cursor position
                        if (oe != os) {
                            p = os;
                            sl = t.slice(p, oe);  // left
                            sr = t.slice(oe);  // right
                            r = /[\t ]+(\n)/g;  // the regex we use

                            // If we have trailing spaces next to caret
                            let mr = sr.match(/^[\t ]*(\n|$)/);
                            if (mr) {
                                o += mr[0].length - (mr[0].slice(-1) == '\n' ? 1 : 0);
                                r = /[\t ]+(\n|$)/g;  // include line end as well
                            }
                            // Check the difference in length
                            ss = sl.replace(r, '$1');
                            o += sl.length - ss.length;
                        }
                        let noe = oe - o;

                        // Store the positions to the cell
                        newSelectionPositions.push({ start: nos, end: noe });
                        p = oe;
                    }

                    // Store selection positions
                    this.newCellSelectionPositions.push(newSelectionPositions);

                    // Actally remove trailing spaces
                    t = t.replace(/[\t ]+(\n|$)/g, '$1');
                    cell.model.value.text = t;
                }
            }
        }

        // After save - restore selection positions
        else if (state == 'completed') {
            for (let cell of this.notebook.widgets) {
                let selectionPositions = this.newCellSelectionPositions.shift();
                let selections: CodeEditor.IRange[] = []
                // Create selections from positions
                for (let selectionPosition of selectionPositions) {
                    selections.push({
                        start: cell.editor.getPositionAt(selectionPosition.start),
                        end: cell.editor.getPositionAt(selectionPosition.end),
                    });
                }
                // Restore the selections
                cell.editor.setSelections(selections);
            }
        }
    }
}


const extension: JupyterFrontEndPlugin<void> = {
    id: PLUGIN_NAME,
    autoStart: true,
    requires: [],

    activate: (app: JupyterFrontEnd) => {
        console.log(`JupyterLab extension ${PLUGIN_NAME} is activated!`);
        // Register trailingspace remover for notebooks
        app.docRegistry.addWidgetExtension('Notebook', new RemoveTrailingSpaceExtension);
    }
};


export default extension;