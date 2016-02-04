import * as dom from 'dom';

export default function(page, signal) {
    [3, 4, 5].forEach(count => {
        dom.on(dom.id('players-link-' + count), 'click', event => {
            signal.changePlayerCount(count);
        });
    });
    
    return {};
}
