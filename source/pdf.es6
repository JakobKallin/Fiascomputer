import R from 'ramda';
import * as dom from 'dom';
import { odd } from 'utils';
import sequentialParsePlayset from './sequential-playset-parser.js';
import equivalenceParsePlayset from './equivalence-playset-parser.js';
import validatePlayset from './validate-playset.js';

export default function load(someFile) {
    PDFJS.workerSrc = '/libraries/pdf.worker.js';
    return someFile instanceof File
        ? readFile(someFile).then(PDFJS.getDocument)
        : PDFJS.getDocument(someFile);
}

const compilations = {
    fiasco: {
        pages: 134,
        playsets: {
            61: 'Main Street',
            71: 'Boomtown',
            81: 'Suburbia',
            91: 'The Ice'
        }
    },
    companion: {
        pages: 170,
        playsets: {
            95: 'Fiasco High',
            105: "Regina's Wedding",
            115: 'Vegas',
            125: 'Mission to Mercury'
        }
    }
};

export function pageNumbers(pdf) {
    const firstPages =
        pdf.numPages === compilations.fiasco.pages
        ? Object.keys(compilations.fiasco.playsets).map(s => parseInt(s))
        : pdf.numPages === compilations.companion.pages
        ? Object.keys(compilations.companion.playsets).map(s => parseInt(s))
        : [1];
    return firstPages.map(firstPage => {
        const isCompilation = firstPage !== 1;
        if ( isCompilation ) {
            return {
                cover: firstPage,
                relationships: [firstPage + 1, firstPage + 2],
                needs: [firstPage + 3, firstPage + 4],
                locations: [firstPage + 5, firstPage + 6],
                objects: [firstPage + 7, firstPage + 8]
            };
        }
        else {
            return {
                cover: 1,
                title: 2,
                score: 3,
                relationships: [4, 5],
                needs: [6, 7],
                locations: [8, 9],
                objects: [10, 11]
            };
        }
    });
}

export function loadPlaysets(pdf) {
    const pages = {};
    return Promise.all(pageNumbers(pdf).map(pageNums => {
        // Load the pages.
        return Promise.all(Object.keys(pageNums).map(name => {
            return Array.isArray(pageNums[name])
                ? Promise.all(pageNums[name].map(num => pdf.getPage(num))).then(ps => pages[name] = ps)
                : pdf.getPage(pageNums[name]).then(p => pages[name] = p);
        }))
        // Call the parsers.
        .then(() => {
            return sequentialParsePlayset(pages).then(first => {
                const firstErrors = validatePlayset(first);
                if ( firstErrors.length === 0 ) {
                    return first;
                }
                else {
                    return equivalenceParsePlayset(pages).then(second => {
                        const secondErrors = validatePlayset(second);
                        if ( firstErrors.length <= secondErrors.length ) {
                            return first;
                        }
                        else {
                            return second;
                        }
                    })
                    .catch(error => {
                        return first;
                    });
                }
            })
            .catch(error => {
                return equivalenceParsePlayset(pages);
            })
            .then(playset => {
                if ( pdf.numPages === compilations.fiasco.pages ) {
                    playset.title = compilations.fiasco.playsets[pageNums.cover];
                }
                else if ( pdf.numPages === compilations.companion.pages ) {
                    playset.title = compilations.companion.playsets[pageNums.cover];
                }
                return playset;
            });
        });
    }));
}

export function loadPage(pdf, num, scale, type, canvas) {
    const toUrl = !canvas;
    canvas = canvas || document.createElement('canvas');
    if ( toUrl ) {
        canvas.style.display = 'none';
        document.body.appendChild(canvas);
    }
    return pdf.getPage(num)
    .then(page => {
        const viewport = page.getViewport(scale);
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        return page.render({
            canvasContext: canvas.getContext('2d'),
            viewport: viewport
        });
    })
    .then(() => {
        if ( toUrl ) {
            const url = canvas.toDataURL(type);
            dom.remove(canvas);
            return url;
        }
        else {
            return canvas;
        }
    });
}

function readFile(file) {
    if ( file instanceof File ) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.addEventListener('load', () => resolve(reader.result));
            reader.addEventListener('error', () => reject(reader.error));
            reader.addEventListener('abort', () => reject(reader.error));
            reader.readAsArrayBuffer(file);
        });
    }
    else {
        return Promise.resolve(file);
    }
}
