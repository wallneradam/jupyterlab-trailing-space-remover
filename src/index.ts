const PLUGIN_NAME = "trailing_space_remover";

import { IDisposable, DisposableDelegate } from '@phosphor/disposable';
import { JupyterFrontEnd, JupyterFrontEndPlugin } from "@jupyterlab/application";
import { DocumentRegistry, DocumentWidget, DocumentModel } from '@jupyterlab/docregistry';
import { NotebookPanel, INotebookModel, Notebook } from '@jupyterlab/notebook';
import { CodeCell } from '@jupyterlab/cells';
import { CodeEditor } from "@jupyterlab/codeeditor";
import { FileEditor } from "@jupyterlab/fileeditor";


type SelectionPosition = { start: number, end: number };
type SelectionPositions = SelectionPosition[];


/**
 * Common trailing space remover
 *
 * It counts the new position of the selections and remove trailing spaces from texts.
 */
class TrailingSpaceRemover {
    private getPosDiff(t: string, p: number, o: number, od: number) {
        let sl = t.slice(p, o);  // left
        let sr = t.slice(o);  // right
        let r = /[\t ]+(\n)/g;  // the regex we use

        // If we have trailing spaces next to caret
        let mr = sr.match(/^[\t ]*(?:\n|$)/);
        if (mr) {
            od += mr[0].length - (mr[0].slice(-1) == '\n' ? 1 : 0);
            r = /[\t ]+(\n|$)/g;  // include line end as well
        }
        // Check the difference in length
        let ss = sl.replace(r, '$1');
        od += sl.length - ss.length;

        return od
    }

    protected removeTrailingSpaceFromEditor(editor: CodeEditor.IEditor): SelectionPositions {
        let t = editor.model.value.text;
        let p = 0, od = 0;
        let newSelectionPositions: SelectionPositions = [];

        // Iterate over all selections the cell have (multicursor)
        for (let selection of editor.getSelections()) {
            // Get start and end offset of the selection
            let os = editor.getOffsetAt(selection.start);
            let oe = editor.getOffsetAt(selection.end);

            // Get difference in position
            od = this.getPosDiff(t, p, os, od)
            // The new start offset
            let nos = os - od;

            // If we have a selection, not just cursor position
            if (oe != os) {
                // Get difference in position
                od = this.getPosDiff(t, os, oe, od)
            }
            // The new end offset
            let noe = oe - od;

            // Store the positions to the cell
            newSelectionPositions.push({ start: nos, end: noe });
            p = oe;
        }

        // Actally remove trailing spaces
        t = t.replace(/[\t ]+(\n|$)/g, '$1');
        editor.model.value.text = t;

        return newSelectionPositions;
    }
}


/**
 * Trailing space remover for notebooks
 */
class RemoveTrailingSpaceNotebook extends TrailingSpaceRemover
    implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel> {

    private notebook: Notebook;
    // This will store the needed new positions of the selections between save start and end
    private newCellSelectionPositions: SelectionPositions[] = [];

    createNew(panel: NotebookPanel, context: DocumentRegistry.IContext<INotebookModel>): IDisposable {
        // The content of the notebook panel will be the actual notebook object
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

            // Go through all cells of the notebook
            for (let cell of this.notebook.widgets) {
                // We care only CodeCells
                if (cell instanceof CodeCell) {
                    // Remove trailing spaces
                    let newSelectionPositions = this.removeTrailingSpaceFromEditor(cell.editor);

                    // Store selection positions
                    this.newCellSelectionPositions.push(newSelectionPositions);
                }
            }
        }

        // After save - restore selection positions
        else if (state == 'completed') {
            for (let cell of this.notebook.widgets) {
                // We care only CodeCells
                if (cell instanceof CodeCell) {
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
}


/**
 * Trailing space remover for editors
 */
class RemoveTrailingSpaceEditor extends TrailingSpaceRemover
    implements DocumentRegistry.IWidgetExtension<DocumentWidget, DocumentModel> {

    private widget: DocumentWidget;
    // This will store the needed new positions of the selections between save start and end
    private newSelectionPositions: SelectionPositions = [];

    createNew(widget: DocumentWidget, context: DocumentRegistry.IContext<DocumentModel>): IDisposable {
        this.widget = widget;
        // Connect to save(State) signal, to be able to detect document save event
        context.saveState.connect(this.onSave, this);
        // Return an empty disposable, because we don't create any object
        return new DisposableDelegate(() => { });
    }

    // Save event handler
    private onSave(context: DocumentRegistry.IContext<DocumentModel>, state: DocumentRegistry.SaveState) {
        // Before save
        if (state == 'started') {
            // Empty the selection positions for sure
            this.newSelectionPositions = [];
            // Only file editor widgets
            if (this.widget.content instanceof FileEditor) {
                // Remove trailing spaces
                this.newSelectionPositions = this.removeTrailingSpaceFromEditor(this.widget.content.editor);
            }
        }

        // After save
        else if (state == 'completed') {
            // Only file editor widgets
            if (this.widget.content instanceof FileEditor) {
                let selections: CodeEditor.IRange[] = []
                for (let selectionPosition of this.newSelectionPositions) {
                    if (this.widget.content instanceof FileEditor) {
                        selections.push({
                            start: this.widget.content.editor.getPositionAt(selectionPosition.start),
                            end: this.widget.content.editor.getPositionAt(selectionPosition.end),
                        });
                    }
                    // Restore the selections
                    this.widget.content.editor.setSelections(selections);
                }
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
        app.docRegistry.addWidgetExtension('notebook', new RemoveTrailingSpaceNotebook);
        // Register trailingspace remover for editors
        app.docRegistry.addWidgetExtension('editor', new RemoveTrailingSpaceEditor);
    }
};


export default extension;