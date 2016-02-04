import * as dom from 'dom';

export default function(page, signal) {
    dom.on(dom.id('add-playset-file-button'), 'click', () => {
        dom.selectFiles().then(files => {
            signal.addPlaysetFiles(files);
        });
    });
    
    dom.drag(page, {
        before: () => page.classList.add('drag'),
        after: () => page.classList.remove('drag'),
        drop: files => signal.addPlaysetFiles(files)
    });
    
    return {};
}
