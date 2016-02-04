import * as dom from 'dom';

export default function(page) {
    dom.on(dom.first('.close-button', page), 'click', event => {
        history.back();
    });
    
    return {};
}
