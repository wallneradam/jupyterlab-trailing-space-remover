const PLUGIN_NAME = "trailing_space_remover";

import {
    IDisposable, DisposableDelegate
} from '@phosphor/disposable';

import {
    JupyterFrontEnd, JupyterFrontEndPlugin,
} from "@jupyterlab/application";

import {
    DocumentRegistry
} from '@jupyterlab/docregistry';

import {
    NotebookPanel, INotebookModel
} from '@jupyterlab/notebook';


import "../style/index.css";


class RemoveTrailingSpaceExtension implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel> {
    createNew(panel: NotebookPanel, context: DocumentRegistry.IContext<INotebookModel>): IDisposable {
        let orig_toJSON = panel.model.toJSON;
        // Override toJSON, to be able to be able to remove trailing spaces.
        //TODO: find a better way! I could not find an easy way to extend model.
        panel.model.toJSON = function () {
            for (let i = 0; i < panel.model.cells.length; i++) {
                let cell = panel.model.cells.get(i);
                if (cell.type == 'code') {
                    cell.value.text = cell.value.text.replace(/[\t ]+$/gm, '');
                }
            }
            let json = orig_toJSON.call(panel.model);
            return json;
        }
        return new DisposableDelegate(() => {
        });
    }
}


const extension: JupyterFrontEndPlugin<void> = {
    id: PLUGIN_NAME,
    autoStart: true,

    activate: (app: JupyterFrontEnd) => {
        console.log(`JupyterLab extension ${PLUGIN_NAME} is activated!`);
        app.docRegistry.addWidgetExtension('Notebook', new RemoveTrailingSpaceExtension);
    }
};


export default extension;