/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';

// const N3 = require('n3');
import { Quad } from 'rdf-js';
const ttlRead = require('@graphy/content.ttl.read');
const ttlWrite = require('@graphy/content.ttl.write');
const dataset = require('@graphy/memory.dataset.fast');
const { finished, Readable } = require('stream');

export class Formatter {
    constructor() { }

    /**
     * Applies the appropriate formats to the active text editor.
     * 
     * @param document TextDocument to format. Edits will be applied to this document.
     * @param selection Range to format. If there is no selection, or the selection is empty, the whole document will be formatted.
     */
    public formatDocument(document: vscode.TextDocument, selection?: vscode.Range) {
        this.getTextEdits(document, selection).then((textEdits) => {
            textEdits.forEach((te) => {
                if (vscode.window.activeTextEditor) {
                    vscode.window.activeTextEditor.edit((textEditorEdit: vscode.TextEditorEdit) => {
                        textEditorEdit.replace(te.range, te.newText);
                    });
                }
            });
        });
    }

    /**
     * Returns a Promise with an array of TextEdits that should be applied when formatting.
     * 
     * @param document TextDocument to format. Edits will be applied to this document.
     * @param selection Range to format. If there is no selection, or the selection is empty, the whole document will be formatted.
     * @return Promise with an array of TextEdit.
     */
    public getTextEdits(document: vscode.TextDocument, selection?: vscode.Range): Thenable<vscode.TextEdit[]> {
        return new Promise((resolve, reject) => {
            // Makes our code a little more readable by extracting the config properties into their own variables.
            let config = vscode.workspace.getConfiguration('ttlformatter');
            let _additionalExtensions: Array<string> = config.get('additionalExtensions', []);

            if (document.languageId !== 'turtle') {
                if (Array.isArray(_additionalExtensions) && _additionalExtensions.indexOf(document.languageId) !== -1) {
                    console.log('File is in additionalExtensions array, continuing...');
                } else {
                    let message: string = 'This is neither a .ttl file, nor anything that was set in additionalExtensions. Aborting...';
                    console.log(message);
                    return reject(message);
                }
            }

            let contentToFix: string = document.getText(); // The content that should be fixed. If there is a selection, this will be replaced with the selected text.

            // First, we'll assume there is no selection, and just select the whole document.
            // Determine the active document's end position (last line, last character).
            let documentEndPosition: vscode.Position =
                new vscode.Position(document.lineCount - 1,
                    document.lineAt(new vscode.Position(document.lineCount - 1, 0)).range.end.character);
            let editRange: vscode.Range = new vscode.Range(new vscode.Position(0, 0), documentEndPosition);

            // If the user made a selection, then only copy the selected text.
            // Also, save that range so we will only replace that part of code after formatting.
            if (selection && Formatter.selectionNotEmpty(selection)) {
                let selectionText = document.getText(selection);
                editRange = selection;
                contentToFix = selectionText;
            }

            this.formatText(contentToFix, (err, fixedContent) => {
                let numSelectedLines: number = Formatter.getNumSelectedLines(editRange, document);
                console.log('Replacing editor content with formatted code.');
                console.log('Document successfully formatted (' + numSelectedLines + ' lines).');

                let textEdits: vscode.TextEdit[] = [];
                if (!err && fixedContent) {
                    textEdits.push(vscode.TextEdit.replace(editRange, fixedContent));
                } else {
                    console.log(`Got error ${err}: no change.`);
                }
                return resolve(textEdits);
            });
        });
    }

    private formatText(contentToFix: string, cb: (err: object | null, fixedContent?: string) => void) {

        let fixedContent = '';
        const quads = [] as Quad[];
        ttlRead(contentToFix, {
            // whew! simplified inline events style  ;)
            data(quad: Quad) {
                quads.push(quad);
            },

            eof(prefixes: { [key: string]: string }) {
                let myDataset = dataset();
                myDataset.addAll(quads);
                let writer = ttlWrite({
                    prefixes,
                });
                myDataset.canonicalize().pipe(writer);

                writer.on('data', (turtle: string) => {
                    fixedContent += turtle;
                });

                writer.on('end', () => {
                    cb(null, fixedContent);
                });
            },
        });


        // let fixedContent = '';

        // // load 'input-a.ttl' into a new Dataset
        // let myDataset = dataset();

        // const readable = Readable.from([contentToFix]);
        // let parsedPrefixes;

        // readable
        //     .pipe(ttlRead())
        //     .on('eof', (prefixes: { [key: string]: string }) => {
        //         parsedPrefixes = prefixes;
        //     })
        //     .pipe(myDataset);

        // myDataset = myDataset.canonicalize();

        // let writer = ttlWrite({
        //     prefixes: parsedPrefixes,
        // });

        // for (const quad of myDataset) {
        //     writer.write(quad);
        // }
        // writer.end();

        // writer.on('data', (turtle: string) => {
        //     fixedContent += turtle;
        // });

        // finished(writer, (err: Error) => {
        //     cb(err, fixedContent);
        // });

        // BELOW IS UNNORMALIZED

        // let fixedContent = '';
        // const quads = [] as Quad[];
        // ttlRead(contentToFix, {
        //     // whew! simplified inline events style  ;)
        //     data(quad: Quad) {
        //         quads.push(quad);
        //     },

        //     eof(prefixes: { [key: string]: string }) {
        //         let writer = ttlWrite({
        //             prefixes,
        //         });

        //         for (const quad of quads) {
        //             writer.write(quad);
        //         }
        //         writer.end();

        //         writer.on('data', (turtle: string) => {
        //             fixedContent += turtle;
        //         });

        //         finished(writer, (err: Error) => {
        //             cb(err, fixedContent);
        //         });
        //     },
        // });


        // const parser = new N3.Parser();

        // parser.parse(contentToFix, (error: Error, quad: Quad, prefixes: { [key: string]: string }) => {
        //     if (error) {
        //         cb(error);
        //         return;
        //     }
        //     if (quad) {
        //         quads.push(quad);
        //     } else {
        //         const writer = new N3.Writer({ prefixes });
        //         writer.addQuads(quads);
        //         writer.end(cb);
        //     }
        // });

    }

    /**
     * Returns the number of selected lines in the given selection.
     * If there is no selection, and a document is passed in, the
     * number of lines the in the given document will be returned.
     * If all else fails, returns 0.
     * 
     * @param selection The selection to count the lines of.
     * @param document The document to get the lineCount of, if there is no selection.
     * @return Number of selected lines as a number. 0 by default.
     */
    private static getNumSelectedLines(selection: vscode.Range, document?: vscode.TextDocument): number {
        let num: number = 0;

        if (Formatter.selectionNotEmpty(selection)) {
            num = selection.end.line + 1 - selection.start.line;
        } else if (document !== undefined) {
            num = document.lineCount;
        }

        return num;
    }

    /**
     * For checking whether a selection is not empty or null.
     * 
     * @param selection The selection to check
     * @return True if selection is null or Range.isEmpty. False otherwise.
     */
    private static selectionNotEmpty(selection: vscode.Range): boolean {
        return selection !== null && !selection.isEmpty;
    }
}

export class TTLDocumentRangeFormattingEditProvider implements vscode.DocumentRangeFormattingEditProvider {
    private formatter: Formatter;

    constructor() {
        this.formatter = new Formatter();
    }

    public provideDocumentRangeFormattingEdits(document: vscode.TextDocument, range: vscode.Range, options: vscode.FormattingOptions, token: vscode.CancellationToken): Thenable<vscode.TextEdit[]> {
        return this.formatter.getTextEdits(document, range);
    }
}